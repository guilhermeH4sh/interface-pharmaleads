"""Atualiza a cobertura nacional e o catálogo completo de municípios.

Fonte: estimativas de população municipal de 2025 do IBGE, tabela 6579.
Com --todos-municipios, usa a API de localidades do IBGE para a agenda.
Não coleta nem altera leads.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen


FONTE = ('https://servicodados.ibge.gov.br/api/v3/agregados/6579/'
         'periodos/2025/variaveis/9324?localidades=N6[all]')
DESTINO = Path(__file__).resolve().parents[1] / 'api' / 'cobertura_nacional.json'
UFS = frozenset('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())
LOCALIDADES = 'https://servicodados.ibge.gov.br/api/v1/localidades'


def ler_json(url: str):
    with urlopen(url, timeout=60) as resposta:
        conteudo = resposta.read()
    return json.loads(gzip.decompress(conteudo) if conteudo[:2] == b'\x1f\x8b' else conteudo)


def atualizar_cache(caminho: Path) -> None:
    estados = ler_json(f'{LOCALIDADES}/estados')
    municipios = ler_json(f'{LOCALIDADES}/municipios')
    por_codigo = {str(estado['id']): estado for estado in estados}
    ids_municipios = {item['id'] for item in municipios}
    if (len(estados) != len(UFS) or {estado['sigla'] for estado in estados} != UFS
            or len(ids_municipios) != len(municipios) or len(municipios) < 5500
            or {str(codigo)[:2] for codigo in ids_municipios} != set(por_codigo)):
        raise ValueError('A resposta de localidades do IBGE está incompleta.')
    data = datetime.now(timezone.utc).isoformat(timespec='seconds')
    linhas = [(item['id'], item['sigla'], item['nome'], item['regiao']['nome'], 'uf', data)
              for item in estados]
    for item in municipios:
        estado = por_codigo[str(item['id'])[:2]]
        linhas.append((item['id'], estado['sigla'], item['nome'], estado['regiao']['nome'], 'municipio', data))
    with closing(sqlite3.connect(caminho)) as con, con:
        con.execute('''CREATE TABLE IF NOT EXISTS ibge_localidades (
            codigo INTEGER PRIMARY KEY, uf TEXT NOT NULL, nome TEXT NOT NULL,
            regiao TEXT NOT NULL, tipo TEXT NOT NULL, atualizado_em TEXT NOT NULL
        )''')
        con.executemany('''INSERT INTO ibge_localidades VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(codigo) DO UPDATE SET uf=excluded.uf, nome=excluded.nome,
            regiao=excluded.regiao, tipo=excluded.tipo, atualizado_em=excluded.atualizado_em''', linhas)
    print(f'{len(estados)} UFs e {len(municipios)} municípios gravados em SQLite.')


def exportar_municipios(caminho: Path) -> None:
    """Gera o catálogo completo usado pela rotação diária, sem tocar nos leads."""
    estados = ler_json(f'{LOCALIDADES}/estados')
    municipios = ler_json(f'{LOCALIDADES}/municipios')
    por_codigo = {str(item['id']): item['sigla'] for item in estados}
    ids = [item['id'] for item in municipios]
    if set(por_codigo.values()) != UFS or len(set(ids)) != len(ids) or len(ids) < 5500:
        raise ValueError('Cadastro incompleto do IBGE; o catálogo original foi preservado.')
    grupos = {uf: [] for uf in sorted(UFS)}
    for item in sorted(municipios, key=lambda item: item['id']):
        uf = por_codigo[str(item['id'])[:2]]
        grupos[uf].append(f"{item['nome']}, {uf}")
    if any(not locais or len(locais) != len(set(locais)) for locais in grupos.values()):
        raise ValueError('Municípios ausentes ou duplicados no IBGE.')
    dados = {'fonte': f'{LOCALIDADES}/municipios',
             'atualizado_em': datetime.now(timezone.utc).isoformat(timespec='seconds'),
             'municipios': grupos}
    temporario = caminho.with_suffix('.tmp')
    temporario.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporario.replace(caminho)
    print(f'{len(ids)} municípios e {len(grupos)} UFs exportados para {caminho}.')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-localidades', type=Path, help='Atualiza o cadastro de UFs e municípios em SQLite.')
    parser.add_argument('--todos-municipios', action='store_true', help='Exporta todas as cidades para a agenda automática.')
    args = parser.parse_args()
    if args.todos_municipios:
        exportar_municipios(DESTINO.with_name('municipios_ibge.json'))
        return
    if args.cache_localidades:
        atualizar_cache(args.cache_localidades)
        return
    dados = ler_json(FONTE)
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
