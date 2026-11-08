"""Gera candidatos CNPJ por telefone exato de leads existentes sem e-mail.

O resultado local exige revisão de nome/endereço; não escreve no Supabase.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen

from pharmaleads.enriquecedor import emails_publicos
from pharmaleads.supabase import Supabase

from scripts.preparar_fila_cnpj import localizacao


BASE = 'https://huggingface.co/datasets/cnpjaberto/cnpj-dados-receita-brasil-2026-09/resolve/main/'


def telefone_brasileiro(texto: str) -> tuple[str, str]:
    digitos = re.sub(r'\D', '', texto or '')
    if digitos.startswith('55') and (texto.strip().startswith('+55') or len(digitos) in (12, 13)):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11) or digitos[0] == '0':
        return '', ''
    ddd, numero = digitos[:2], digitos[2:]
    if len(set(numero)) == 1:
        return '', ''
    return ddd, numero


def preparar_fila(destino: Path) -> int:
    estado = json.loads(Path('dados/recuperacao_emails.json').read_text(encoding='utf-8'))
    escopo = {lead['chave'] for lead in estado['leads']}
    if len(escopo) != 12298:
        raise ValueError('A lista original deve conter exatamente 12.298 leads distintos.')
    vistos = set()
    fila = []
    for lead in Supabase().listar('chave,nome,endereco,local_busca,telefone,emails'):
        chave = lead['chave']
        if chave not in escopo:
            continue
        vistos.add(chave)
        if emails_publicos(lead.get('emails') or ''):
            continue
        ddd, numero = telefone_brasileiro(lead.get('telefone') or '')
        if not ddd:
            continue
        cep, uf = localizacao(lead.get('endereco') or '', lead.get('local_busca') or '')
        fila.append({campo: lead.get(campo) or '' for campo in
                     ('chave', 'nome', 'endereco', 'telefone')} |
                    {'ddd': ddd, 'numero': numero, 'cep': cep, 'uf': uf})
    if vistos != escopo:
        raise ValueError('Nem todos os leads originais estão acessíveis no Supabase.')
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(fila, ensure_ascii=False), encoding='utf-8')
    return len(fila)


def cruzar(fila: Path, indices: set[int], saida: Path) -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'dados' / '.deps'))
    import duckdb

    with urlopen(BASE + '_manifest.json', timeout=30) as resposta:
        arquivos = {int(item['file'].removesuffix('.parquet').split('estabelecimentos')[-1]): item
                    for item in json.load(resposta)['files'] if item['table'] == 'estabelecimentos'}
    if not indices <= arquivos.keys():
        raise ValueError('Arquivo de estabelecimentos ausente no manifesto público.')
    con = duckdb.connect('dados/cnpj_telefone.duckdb')
    con.execute("SET memory_limit='2GB'")
    total = 0
    with saida.open('w', encoding='utf-8') as destino:
        for indice in sorted(indices):
            url = BASE + arquivos[indice]['file']
            consulta = con.execute("""
                SELECT l.chave, l.nome AS nome_lead, l.endereco AS endereco_lead,
                       l.telefone AS telefone_lead, l.cep AS cep_lead, l.uf AS uf_lead,
                       s.cnpj_basico || s.cnpj_ordem || s.cnpj_dv AS cnpj,
                       s.nome_fantasia, s.tipo_logradouro, s.logradouro, s.numero,
                       s.complemento, s.bairro, s.cep, s.uf, s.ddd1, s.telefone1,
                       s.correio_eletronico AS email, s.cnae_fiscal_principal
                FROM read_parquet(?) s
                JOIN read_json_auto(?) l
                  ON regexp_replace(s.ddd1, '[^0-9]', '', 'g') = l.ddd
                 AND regexp_replace(s.telefone1, '[^0-9]', '', 'g') = l.numero
                WHERE s.situacao_cadastral = '02'
                  AND s.correio_eletronico IS NOT NULL
                  AND length(trim(s.correio_eletronico)) > 3
            """, [url, str(fila)])
            colunas = [item[0] for item in consulta.description]
            while lote := consulta.fetchmany(1000):
                for linha in lote:
                    destino.write(json.dumps(dict(zip(colunas, linha)) | {'fonte': url},
                                             ensure_ascii=False) + '\n')
                total += len(lote)
            print(f'estabelecimentos{indice}.parquet: {total} candidatos acumulados.', flush=True)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shards', default='0,1,2,3,4,5,6,7,8,9')
    parser.add_argument('--fila', type=Path, default=Path('dados/fila_cnpj_telefone.json'))
    parser.add_argument('--saida', type=Path, default=Path('dados/cnpj_candidatos_telefone.jsonl'))
    parser.add_argument('--somente-preparar', action='store_true')
    parser.add_argument('--usar-fila-existente', action='store_true')
    args = parser.parse_args()
    tamanho = (len(json.loads(args.fila.read_text(encoding='utf-8')))
               if args.usar_fila_existente else preparar_fila(args.fila))
    print(f'{tamanho} leads originais sem e-mail têm telefone brasileiro para cruzamento.', flush=True)
    if not args.somente_preparar:
        total = cruzar(args.fila, {int(x) for x in args.shards.split(',')}, args.saida)
        print(f'{total} candidatos locais. Nenhum e-mail foi gravado no Supabase.', flush=True)


if __name__ == '__main__':
    main()
