"""Plano diário e disparo do coletor pelo Cron Job do Render."""
from __future__ import annotations

import json
import os
import sys
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from .config import ErroPharmaLeads, SEGMENTOS_PADRAO
from .gerador import montar_consultas, validar_segmentos
from .supabase import SemRedirecionamento


HORARIOS = (7, 13, 19)
UFS = frozenset('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())
FUSO = timezone(timedelta(hours=-3))


@lru_cache(maxsize=1)
def municipios_por_uf() -> dict[str, tuple[str, ...]]:
    caminho = Path(__file__).resolve().parent.parent / 'api' / 'municipios_ibge.json'
    dados = json.loads(caminho.read_text(encoding='utf-8'))['municipios']
    if (set(dados) != UFS or sum(len(locais) for locais in dados.values()) < 5500
            or any(not locais or len(locais) != len(set(locais)) or
                   any(not local.endswith(f', {uf}') for local in locais) for uf, locais in dados.items())):
        raise ErroPharmaLeads('Catálogo de municípios inválido; atualize a cobertura do IBGE.')
    def ordem_alfabetica(local: str) -> str:
        return ''.join(c for c in unicodedata.normalize('NFKD', local)
                       if not unicodedata.combining(c)).casefold()
    return {uf: tuple(sorted(locais, key=ordem_alfabetica)) for uf, locais in dados.items()}


def plano_agendado(grupo: int, dia: str, cidades_por_uf: int = 4) -> list[str]:
    """Toda execução visita todas as UFs; a janela de cidades avança a cada horário."""
    try:
        data = date.fromisoformat(dia)
        quantidade = int(cidades_por_uf)
    except (ValueError, TypeError):
        raise ErroPharmaLeads('Data ou quantidade de cidades inválida.') from None
    if grupo not in HORARIOS or not 1 <= quantidade <= 4:
        raise ErroPharmaLeads('Informe horário da agenda e de 1 a 4 cidades por UF.')
    municipios = municipios_por_uf()
    turno = (data - date(2026, 1, 1)).days * len(HORARIOS) + HORARIOS.index(grupo)
    estados = sorted(UFS)
    # Agrupa cada UF em ordem alfabética e avança a janela a cada horário.
    return [municipios[uf][(turno * quantidade + indice) % len(municipios[uf])]
            for uf in estados for indice in range(quantidade) if indice < len(municipios[uf])]


def entrada_agendada(grupo: int, rodada: int, request_id: str, *, dia: str | None = None,
                     cidades_por_uf: int | None = None, segmentos: str | None = None) -> dict[str, str]:
    dia = dia or datetime.now(FUSO).date().isoformat()
    try:
        quantidade = int(cidades_por_uf if cidades_por_uf is not None else os.environ.get('AGENDA_CIDADES_POR_UF', '4'))
    except (ValueError, TypeError):
        raise ErroPharmaLeads('Quantidade de cidades inválida.') from None
    locais = plano_agendado(grupo, dia, quantidade)
    segmentos = segmentos if segmentos is not None else os.environ.get('AGENDA_SEGMENTOS', ','.join(SEGMENTOS_PADRAO))
    if not isinstance(segmentos, str):
        raise ErroPharmaLeads('Segmentos da agenda inválidos.')
    tipos = validar_segmentos(segmentos.split(','))
    buscas_por_cidade = len(montar_consultas([locais[0]], tipos)) if locais and tipos else 0
    cidades_por_rodada = min(2, 8 // buscas_por_cidade) if buscas_por_cidade else 0
    if not cidades_por_rodada:
        raise ErroPharmaLeads('Os segmentos da agenda excedem 8 buscas por cidade.')
    lotes = [locais[i:i + cidades_por_rodada]
             for i in range(0, len(locais), cidades_por_rodada)]
    if not 1 <= rodada <= len(lotes):
        raise ErroPharmaLeads('Segmentos ou rodada da agenda inválidos.')
    cidades = lotes[rodada - 1]
    resumo = ' · '.join(cidades)
    return {
        'modo': 'agenda', 'grupo': str(grupo), 'rodada': str(rodada),
        'total_rodadas': str(len(lotes)), 'locais': '\n'.join(cidades), 'resumo': resumo,
        'segmentos': ','.join(tipos), 'profundidade': '1', 'emails': 'false',
        'enriquecer_sites': 'false', 'request_id': request_id,
        'dia': dia, 'cidades_por_uf': str(quantidade),
    }


def disparar(agora: datetime) -> None:
    # O cron usa UTC. Os três horários acordados correspondem a UTC-3.
    local = agora.astimezone(timezone(timedelta(hours=-3)))
    if local.hour not in HORARIOS:
        print('Horário fora dos três disparos da agenda.')
        return
    base = os.environ.get('RENDER_COLLECTOR_URL', '').strip().rstrip('/')
    token = os.environ.get('RENDER_COLLECTOR_TOKEN', '').strip()
    api_key = os.environ.get('RENDER_API_KEY', '').strip()
    destino = urlsplit(base)
    if (destino.scheme != 'https' or not destino.hostname or destino.username or destino.password
            or destino.path or destino.query or destino.fragment or not token or not api_key):
        raise ErroPharmaLeads('Configure a URL HTTPS, o token do coletor e a chave do Render no Cron Job.')
    request_id = f'agenda-{local:%Y-%m-%d-%H}'
    request = Request(
        f'{base}/v1/jobs/start',
        data=json.dumps(entrada_agendada(local.hour, 1, request_id, dia=local.date().isoformat())).encode(),
        headers={'Authorization': f'Bearer {token}', 'X-Render-Api-Key': api_key,
                 'Content-Type': 'application/json'},
        method='POST',
    )
    opener = build_opener(SemRedirecionamento())
    # Aguarda um coletor ocupado dentro da janela de disparo. Qualquer
    # resposta ambígua encerra o cron para evitar repetir um início aceito.
    limite = local.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    while datetime.now(timezone.utc) < limite:
        try:
            with opener.open(request, timeout=30) as resposta:
                run = json.load(resposta).get('run') or {}
                if resposta.status != 202 or not run.get('id'):
                    raise ErroPharmaLeads('Resposta inesperada do coletor. Verifique One-Off Jobs.')
                print(f'Grupo {local.hour:02d}h enviado. Job {run["id"]}.')
                return
        except HTTPError as exc:
            if exc.code != 409:
                raise ErroPharmaLeads(f'Coletor respondeu HTTP {exc.code}.') from None
            print('Coletor ocupado. Nova tentativa em 60 segundos.', flush=True)
            time.sleep(60)
        except (URLError, OSError, ValueError):
            raise ErroPharmaLeads('Falha ao disparar. Verifique One-Off Jobs antes de repetir.') from None
    raise ErroPharmaLeads('A janela de disparo terminou enquanto o coletor estava ocupado.')


def main() -> int:
    try:
        disparar(datetime.now(timezone.utc))
        return 0
    except ErroPharmaLeads as exc:
        print(exc, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
