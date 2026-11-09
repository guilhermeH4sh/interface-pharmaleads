"""Amplia a cobertura nacional com os municípios mais populosos de cada UF.

Fonte: estimativas de população municipal de 2025 do IBGE, tabela 6579.
Não coleta nem altera leads; atualiza apenas api/cobertura_nacional.json.
"""
from __future__ import annotations

import gzip
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen


FONTE = ('https://servicodados.ibge.gov.br/api/v3/agregados/6579/'
         'periodos/2025/variaveis/9324?localidades=N6[all]')
DESTINO = Path(__file__).resolve().parents[1] / 'api' / 'cobertura_nacional.json'
UFS = frozenset('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())


def main() -> None:
    with urlopen(FONTE, timeout=60) as resposta:
        conteudo = resposta.read()
    dados = json.loads(gzip.decompress(conteudo) if conteudo[:2] == b'\x1f\x8b' else conteudo)
    series = dados[0]['resultados'][0]['series']
    por_uf: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for item in series:
        nome, uf = item['localidade']['nome'].rsplit(' - ', 1)
        populacao = item['serie']['2025']
        if uf in UFS and populacao.isdigit():
            por_uf[uf].append((int(populacao), f'{nome}, {uf}'))
    if set(por_uf) != UFS or len(series) < 5500:
        raise ValueError('A resposta do IBGE está incompleta; o plano original foi preservado.')

    plano = json.loads(DESTINO.read_text(encoding='utf-8'))
    existentes = {local.casefold() for local in plano['capitais'] + plano['interior']}
    adicionados = 0
    for uf in sorted(UFS):
        for _, local in sorted(por_uf[uf], reverse=True)[:10]:
            if local.casefold() not in existentes:
                plano['interior'].append(local)
                existentes.add(local.casefold())
                adicionados += 1
    DESTINO.write_text(json.dumps(plano, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{adicionados} municípios acrescentados; {len(existentes)} locais na cobertura nacional.')


if __name__ == '__main__':
    main()
