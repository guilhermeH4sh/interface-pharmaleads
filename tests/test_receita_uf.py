import csv
import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from zipfile import ZipFile

from scripts.importar_receita_uf import importar_arquivo, preparar_banco


def estabelecimento(cnpj, uf, cnae, secundario='', situacao='02'):
    linha = [''] * 30
    linha[:3] = [cnpj[:8], cnpj[8:12], cnpj[12:]]
    linha[4], linha[5], linha[11], linha[12], linha[19] = 'Farmácia', situacao, cnae, secundario, uf
    linha[21], linha[22], linha[27] = '61', '33334444', 'contato@example.com'
    return linha


def zip_estabelecimentos(caminho, linhas):
    buffer = io.StringIO(newline='')
    csv.writer(buffer, delimiter=';').writerows(linhas)
    with ZipFile(caminho, 'w') as arquivo:
        arquivo.writestr('amostra.ESTABELE', buffer.getvalue().encode('latin-1'))


class TestReceitaUF(unittest.TestCase):
    def test_filtra_df_deduplica_e_retoma(self):
        varejo = estabelecimento('12345678000195', 'DF', '4771701')
        por_secundario = estabelecimento('12345678000276', 'DF', '0000000', '4771702, 0000000')
        with tempfile.TemporaryDirectory() as pasta, closing(sqlite3.connect(':memory:')) as con:
            arquivo = Path(pasta) / 'Estabelecimentos0.zip'
            zip_estabelecimentos(arquivo, [
                varejo, varejo, por_secundario,
                estabelecimento('12345678000357', 'SP', '4771701'),
                estabelecimento('12345678000438', 'DF', '4771701', situacao='08'),
                estabelecimento('12345678000519', 'DF', '4773300'),
            ])
            preparar_banco(con)
            resultado = importar_arquivo(con, arquivo, 'DF', '2026-10')
            self.assertEqual((resultado['examinados'], resultado['novos'], resultado['duplicados']), (6, 2, 1))
            self.assertTrue(importar_arquivo(con, arquivo, 'DF', '2026-10')['retomado'])
            self.assertEqual(importar_arquivo(con, arquivo, 'SP', '2026-10')['novos'], 1)
            cadastro = json.loads(con.execute(
                'SELECT cadastro FROM receita_estabelecimentos WHERE cnpj=?', ('12345678000276',)
            ).fetchone()[0])
            self.assertEqual(cadastro['cnaes_correspondentes'], ['4771702'])
            self.assertEqual((cadastro['email'], cadastro['telefones']), ('contato@example.com', ['6133334444']))

    def test_arquivo_invalido_reverte_dados_e_checkpoint(self):
        linhas = [estabelecimento(f'{i:012d}95', 'DF', '4771701') for i in range(1000)]
        with tempfile.TemporaryDirectory() as pasta, closing(sqlite3.connect(':memory:')) as con:
            arquivo = Path(pasta) / 'Estabelecimentos0.zip'
            zip_estabelecimentos(arquivo, linhas + [['layout inválido']])
            preparar_banco(con)
            with self.assertRaisesRegex(ValueError, 'linha 1001'):
                importar_arquivo(con, arquivo, 'DF', '2026-10')
            self.assertEqual(con.execute('SELECT count(*) FROM receita_estabelecimentos').fetchone()[0], 0)
            self.assertEqual(con.execute('SELECT count(*) FROM receita_arquivos').fetchone()[0], 0)
