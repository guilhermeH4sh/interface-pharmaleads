"""Fila da cobertura nacional. O estado da fila é o número da rodada no GitHub Actions."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from . import config
from .config import ErroPharmaLeads
from .gerador import validar_segmentos

LIMITE_BUSCAS = 20
WORKFLOW = 'cloud-collect.yml'


def _plano() -> tuple[list[str], list[str]]:
    caminho = Path(__file__).resolve().parent.parent / 'api' / 'cobertura_nacional.json'
    dados = json.loads(caminho.read_text(encoding='utf-8'))
    return list(dados['capitais']), list(dados['interior'])


def locais_nacionais() -> list[str]:
    capitais, interior = _plano()
    return capitais + interior


def montar_fila(segmentos: list[str]) -> list[list[str]]:
    """Agrupa os locais sem ultrapassar 20 buscas por rodada."""
    segmentos = validar_segmentos(segmentos)
    por_local = sum(len(config.SEGMENTOS[nome]['termos']) for nome in segmentos)
    tamanho = LIMITE_BUSCAS // por_local
    if por_local < 1 or tamanho < 1:
        raise ErroPharmaLeads('Os segmentos escolhidos não cabem em 20 buscas.')
    locais = locais_nacionais()
    return [locais[i:i + tamanho] for i in range(0, len(locais), tamanho)]


def entradas_seguintes(rodada: int, segmentos: list[str], profundidade: str,
                       emails: str, enriquecer: str, request_id: str) -> dict | None:
    """Devolve os inputs da próxima rodada, ou None quando a fila acabou."""
    fila = montar_fila(segmentos)
    if rodada < 1 or rodada > len(fila):
        raise ErroPharmaLeads('Rodada nacional inválida.')
    if rodada == len(fila):
        return None
    locais = fila[rodada]
    proxima = rodada + 1
    base = re.sub(r'-r\d+$', '', request_id) or 'nacional'
    return {
        'request_id': f'{base}-r{proxima}',
        'locais': '\n'.join(locais),
        'segmentos': ','.join(segmentos),
        'profundidade': profundidade,
        'emails': emails,
        'enriquecer_sites': enriquecer,
        'modo': 'nacional',
        'rodada': str(proxima),
        'total_rodadas': str(len(fila)),
        'resumo': ' · '.join(locais)[:180],
    }


def despachar(token: str, repositorio: str, entradas: dict) -> None:
    requisicao = urllib.request.Request(
        f'https://api.github.com/repos/{repositorio}/actions/workflows/{WORKFLOW}/dispatches',
        data=json.dumps({'ref': 'main', 'inputs': entradas}).encode(),
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'pharmaleads-cobertura',
        },
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=30) as resposta:
            if resposta.status not in (200, 204):
                raise ErroPharmaLeads(f'GitHub respondeu HTTP {resposta.status}.')
    except urllib.error.HTTPError as exc:
        raise ErroPharmaLeads(f'GitHub respondeu HTTP {exc.code} ao agendar a rodada seguinte.') from None


def main() -> int:
    try:
        entradas = entradas_seguintes(
            int(os.environ['RODADA']),
            [item.strip() for item in os.environ['SEGMENTOS'].split(',') if item.strip()],
            os.environ['PROFUNDIDADE'],
            os.environ.get('EMAILS', 'false'),
            os.environ.get('ENRIQUECER_SITES', 'false'),
            os.environ.get('REQUEST_ID', 'nacional'),
        )
        if entradas is None:
            print('Cobertura nacional concluída.', flush=True)
            return 0
        despachar(os.environ['GITHUB_TOKEN'], os.environ['GITHUB_REPOSITORY'], entradas)
        print(f"Rodada {entradas['rodada']} de {entradas['total_rodadas']} agendada.", flush=True)
        return 0
    except (KeyError, ValueError, ErroPharmaLeads, OSError) as exc:
        print(f'Não foi possível agendar a rodada seguinte: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
