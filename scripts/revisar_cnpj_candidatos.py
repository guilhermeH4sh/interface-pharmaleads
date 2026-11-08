"""Prioriza candidatos CNPJ por nome, rua e número para revisão humana."""
import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from pharmaleads.enriquecedor import emails_publicos

GENERICOS = frozenset('FARMACIA FARMACIAS FARMA DROGARIA DROGARIAS MANIPULACAO '
                     'MEDICAMENTOS PRODUTOS COMERCIO DISTRIBUIDORA DISTRIBUICAO '
                     'CLINICA VETERINARIA HOSPITAL HOMEOPATIA PET SAUDE LOJA '
                     'LTDA DE DO DA DOS DAS E'.split())


def normalizar(texto: str) -> str:
    sem_acentos = unicodedata.normalize('NFKD', texto or '')
    sem_acentos = ''.join(c for c in sem_acentos if not unicodedata.combining(c))
    return ' '.join(re.findall(r'[A-Z0-9]+', sem_acentos.upper()))


def numero_lead(nome: str, endereco: str) -> str:
    restante = endereco[len(nome):] if endereco.startswith(nome) else endereco
    busca = re.search(r',\s*(?:N[º°.]*\s*)?(\d{1,6})(?!\d)', restante)
    return str(int(busca.group(1))) if busca else ''


def prioridade(registro: dict) -> dict | None:
    nome = normalizar(registro['nome_lead'])
    fantasia = normalizar(registro.get('nome_fantasia') or '')
    logradouro = normalizar(registro.get('logradouro') or '')
    endereco = normalizar(registro['endereco_lead'])
    numero = numero_lead(registro['nome_lead'], registro['endereco_lead'])
    num_cnpj = re.search(r'^0*(\d+)$', registro.get('numero') or '')
    if not fantasia or not logradouro or not numero or not num_cnpj:
        return None
    if int(numero) != int(num_cnpj.group(1)):
        return None
    # Exige correspondência de rua distintiva, não só CEP e número.
    palavras_rua = [p for p in logradouro.split() if len(p) >= 3]
    if len(palavras_rua) < 2 or not all(p in endereco.split() for p in palavras_rua):
        return None
    marca_lead = {p for p in nome.split() if len(p) >= 4 and p not in GENERICOS}
    marca_cnpj = {p for p in fantasia.split() if len(p) >= 4 and p not in GENERICOS}
    marca_compacta = ''.join(nome.split()) in ''.join(fantasia.split()) or \
                     ''.join(fantasia.split()) in ''.join(nome.split())
    nome_similar = (bool(marca_lead & marca_cnpj) or marca_compacta) and (
        fantasia in nome or nome in fantasia or marca_compacta or
        SequenceMatcher(None, nome, fantasia).ratio() >= 0.78)
    if not nome_similar:
        return None
    if not emails_publicos(registro.get('email') or ''):
        return None
    return registro | {'criterio': 'fantasia+logradouro+numero+cep+uf'}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('entrada', type=Path)
    parser.add_argument('--saida', type=Path, default=Path('dados/cnpj_candidatos_prioritarios.jsonl'))
    args = parser.parse_args()
    total = 0
    chaves = set()
    with args.entrada.open(encoding='utf-8') as origem, args.saida.open('w', encoding='utf-8') as destino:
        for linha in origem:
            registro = prioridade(json.loads(linha))
            if registro:
                destino.write(json.dumps(registro, ensure_ascii=False) + '\n')
                total += 1
                chaves.add(registro['chave'])
    print(f'{total} possíveis correspondências fortes para {len(chaves)} leads; revisão ainda necessária.')


if __name__ == '__main__':
    main()
