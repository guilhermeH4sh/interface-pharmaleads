"""Plano diário e disparo do coletor pelo Cron Job do Render."""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from .config import ErroPharmaLeads
from .supabase import SemRedirecionamento


GRUPOS = {
    7: ('São Paulo, SP', 'Paraná, PR', 'Santa Catarina, SC', 'Rio Grande do Sul, RS',
        'Mato Grosso do Sul, MS', 'Mato Grosso, MT', 'Goiás, GO', 'Distrito Federal, DF', 'Tocantins, TO'),
    13: ('Minas Gerais, MG', 'Espírito Santo, ES', 'Bahia, BA', 'Sergipe, SE', 'Alagoas, AL',
         'Pernambuco, PE', 'Paraíba, PB', 'Rio Grande do Norte, RN', 'Ceará, CE'),
    19: ('Rio de Janeiro, RJ', 'Maranhão, MA', 'Piauí, PI', 'Pará, PA', 'Amapá, AP',
         'Amazonas, AM', 'Roraima, RR', 'Acre, AC', 'Rondônia, RO'),
}


def entrada_agendada(grupo: int, rodada: int, request_id: str) -> dict[str, str]:
    locais = GRUPOS.get(grupo)
    if not locais or not 1 <= rodada <= len(locais):
        raise ErroPharmaLeads('Grupo ou rodada da agenda inválido.')
    local = locais[rodada - 1]
    return {
        'modo': 'agenda', 'grupo': str(grupo), 'rodada': str(rodada),
        'total_rodadas': str(len(locais)), 'locais': local, 'resumo': local,
        'segmentos': 'varejo', 'profundidade': '1', 'emails': 'false',
        'enriquecer_sites': 'false', 'request_id': request_id,
    }


def disparar(agora: datetime) -> None:
    # O cron usa UTC. Os três horários acordados correspondem a UTC-3.
    local = agora.astimezone(timezone(timedelta(hours=-3)))
    if local.hour not in GRUPOS:
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
        data=json.dumps(entrada_agendada(local.hour, 1, request_id)).encode(),
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
