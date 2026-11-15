"""Indexa por UF os arquivos Estabelecimentos do CNPJ em um SQLite local."""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


CNAES = {'4771701', '4771702', '4771703', '4771704', '4644301', '4644302'}
UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split()
TODAS = 'TODAS'


def preparar_banco(con):
    con.executescript('''
        CREATE TABLE IF NOT EXISTS receita_estabelecimentos (
            competencia TEXT NOT NULL, cnpj TEXT NOT NULL, uf TEXT NOT NULL,
            cadastro TEXT NOT NULL, PRIMARY KEY (competencia, cnpj)
        );
        CREATE INDEX IF NOT EXISTS receita_competencia_uf
            ON receita_estabelecimentos(competencia, uf);
        CREATE TABLE IF NOT EXISTS receita_arquivos (
            competencia TEXT NOT NULL, uf TEXT NOT NULL, arquivo TEXT NOT NULL,
            PRIMARY KEY (competencia, uf, arquivo)
        );
    ''')


def importar_arquivo(con, caminho, uf, competencia):
    inicio = time.monotonic()
    with ZipFile(caminho) as zip_file:
        arquivos = [info for info in zip_file.infolist() if not info.is_dir()]
        if len(arquivos) != 1 or not arquivos[0].filename.upper().endswith('.ESTABELE'):
            raise ValueError(f'{caminho.name} deve conter um arquivo .ESTABELE.')
        membro = arquivos[0]
        chave = (competencia, uf, f'{membro.filename}:{membro.CRC}:{membro.file_size}')
        with con:
            registro = con.execute('INSERT OR IGNORE INTO receita_arquivos VALUES (?,?,?)', chave)
            if registro.rowcount == 0:
                return {'arquivo': caminho.name, 'retomado': True}

            data = datetime.now(timezone.utc).isoformat(timespec='seconds')
            examinados = elegiveis = inseridos = 0
            lote = []
            with io.TextIOWrapper(zip_file.open(membro), encoding='latin-1', newline='') as arquivo:
                for linha in csv.reader(arquivo, delimiter=';', strict=True):
                    examinados += 1
                    if len(linha) != 30:
                        raise ValueError(f'Layout inesperado em {caminho.name}, linha {examinados}.')
                    uf_cadastro = linha[19]
                    if linha[5] not in {'2', '02'} or (uf != TODAS and uf_cadastro != uf) or uf_cadastro not in UFS:
                        continue
                    secundarios = [codigo.strip() for codigo in linha[12].split(',') if codigo.strip()]
                    atividade = CNAES.intersection([linha[11], *secundarios])
                    if not atividade:
                        continue
                    cnpj = ''.join(linha[:3])
                    if not re.fullmatch(r'[A-Z0-9]{12}[0-9]{2}', cnpj):
                        raise ValueError(f'CNPJ fora do formato em {caminho.name}, linha {examinados}.')
                    cadastro = {
                        'cnpj': cnpj, 'uf': uf_cadastro, 'nome_fantasia': linha[4], 'situacao_cadastral': '02',
                        'inicio_atividade': linha[10], 'cnae_principal': linha[11],
                        'cnaes_secundarios': secundarios, 'cnaes_correspondentes': sorted(atividade),
                        'tipo_logradouro': linha[13], 'logradouro': linha[14], 'numero': linha[15],
                        'complemento': linha[16], 'bairro': linha[17], 'cep': linha[18],
                        'codigo_municipio_receita': linha[20],
                        'telefones': [linha[i] + linha[i + 1] for i in (21, 23) if linha[i + 1]],
                        'email': linha[27], 'fonte': 'Receita Federal — Dados Abertos do CNPJ',
                        'competencia': competencia, 'importado_em': data,
                    }
                    elegiveis += 1
                    lote.append((competencia, cnpj, uf_cadastro, json.dumps(cadastro, ensure_ascii=False)))
                    if len(lote) == 1000:
                        inseridos += con.executemany(INSERIR, lote).rowcount
                        lote.clear()
                inseridos += con.executemany(INSERIR, lote).rowcount

    return {'arquivo': caminho.name, 'examinados': examinados, 'elegiveis': elegiveis,
            'novos': inseridos, 'duplicados': elegiveis - inseridos,
            'segundos': round(time.monotonic() - inicio, 3)}


INSERIR = 'INSERT OR IGNORE INTO receita_estabelecimentos VALUES (?,?,?,?)'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--uf', required=True, type=str.upper, choices=[*UFS, TODAS])
    parser.add_argument('--competencia', required=True, help='Competência do dump no formato AAAA-MM')
    parser.add_argument('--banco', type=Path, required=True, help='SQLite local dedicado à importação')
    parser.add_argument('arquivos', type=Path, nargs='+', help='ZIPs Estabelecimentos da competência')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', args.competencia):
        parser.error('Use uma competência no formato AAAA-MM.')
    with closing(sqlite3.connect(args.banco)) as con:
        preparar_banco(con)
        for caminho in args.arquivos:
            print(json.dumps(importar_arquivo(con, caminho, args.uf, args.competencia), ensure_ascii=False), flush=True)
        total = con.execute('''SELECT count(*) FROM receita_estabelecimentos
            WHERE competencia=? AND (? = 'TODAS' OR uf=?)''',
                            (args.competencia, args.uf, args.uf)).fetchone()[0]
        print(json.dumps({'uf': args.uf, 'total_cnpjs': total}))


if __name__ == '__main__':
    main()
