"""Fila determinística usada pela cobertura nacional no serviço de coleta."""
from __future__ import annotations

import json
import re
from pathlib import Path

from . import config
from .config import ErroPharmaLeads
from .gerador import validar_segmentos

# Coletas com e-mail visitam também os sites dos estabelecimentos. O limite
# público continua sendo 20, mas as rodadas nacionais precisam ser menores
# para controlar memória, duração e bloqueios no serviço de coleta.
LIMITE_BUSCAS = 8


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
