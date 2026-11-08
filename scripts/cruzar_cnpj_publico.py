"""Cruza leads sem e-mail com dados abertos de estabelecimentos CNPJ.

Produz candidatos locais para revisão. Nunca atualiza o Supabase. A junção por
CEP e UF apenas reduz o universo; nome, endereço e telefone ainda precisam ser
conferidos antes de associar o e-mail ao lead.
"""
import argparse
import json
import sys
from pathlib import Path
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'dados' / '.deps'))
import duckdb


BASE = 'https://huggingface.co/datasets/cnpjaberto/cnpj-dados-receita-brasil-2026-09/resolve/main/'
MANIFESTO = BASE + '_manifest.json'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--shards', default='1', help='Números dos arquivos Estabelecimentos separados por vírgula')
    parser.add_argument('--saida', type=Path, default=Path('dados/cnpj_candidatos_piloto.jsonl'))
    args = parser.parse_args()
    indices = {int(valor) for valor in args.shards.split(',')}
    with urlopen(MANIFESTO, timeout=30) as resposta:
        arquivos = {int(registro['file'].removesuffix('.parquet').split('estabelecimentos')[-1]): registro
                    for registro in json.load(resposta)['files'] if registro['table'] == 'estabelecimentos'}
    if not indices <= arquivos.keys():
        raise ValueError('Arquivo de estabelecimentos ausente no manifesto público.')
    fila = Path('dados/fila_cnpj_sem_email.json')
    if not fila.is_file():
        raise FileNotFoundError('Gere a fila com python -m scripts.preparar_fila_cnpj')

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect('dados/cnpj_piloto.duckdb')
    con.execute("SET memory_limit='2GB'")
    total = 0
    with args.saida.open('w', encoding='utf-8') as destino:
        for indice in sorted(indices):
            caminho = arquivos[indice]['file']
            url = BASE + caminho
            consulta = con.execute("""
                SELECT l.chave, l.nome AS nome_lead, l.endereco AS endereco_lead,
                       l.telefone AS telefone_lead, s.cnpj_basico || s.cnpj_ordem || s.cnpj_dv AS cnpj,
                       s.nome_fantasia, s.tipo_logradouro, s.logradouro, s.numero,
                       s.complemento, s.bairro, s.cep, s.uf, s.ddd1, s.telefone1,
                       s.correio_eletronico AS email, s.cnae_fiscal_principal
                FROM read_parquet(?) s
                JOIN read_json_auto(?) l USING (cep, uf)
                WHERE s.situacao_cadastral = '02'
                  AND s.correio_eletronico IS NOT NULL
                  AND length(trim(s.correio_eletronico)) > 3
            """, [url, str(fila)])
            colunas = [item[0] for item in consulta.description]
            while True:
                lote = consulta.fetchmany(1000)
                if not lote:
                    break
                for linha in lote:
                    registro = dict(zip(colunas, linha)) | {'fonte': url}
                    destino.write(json.dumps(registro, ensure_ascii=False) + '\n')
                total += len(lote)
            print(f'{caminho}: {total} candidatos por CEP/UF acumulados.', flush=True)
    print(f'{total} candidatos locais. Nenhum e-mail foi gravado no Supabase.')


if __name__ == '__main__':
    main()
