"""Prepara correspondências candidatas com os dados abertos de CNPJ.

O arquivo local contém apenas leads já presentes no escopo original. Não grava
nenhum dado no Supabase.
"""
import json
import re
from pathlib import Path

from pharmaleads.enriquecedor import emails_publicos
from pharmaleads.supabase import Supabase


UF = frozenset('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())
CEP = re.compile(r'(?<!\d)(\d{5})-?(\d{3})(?!\d)')
SIGLA = re.compile(r'(?:^|[,/\s-])([A-Z]{2})(?=[,/\s-]|$)')


def localizacao(endereco: str, local_busca: str) -> tuple[str, str]:
    postal = CEP.findall(endereco or '')
    siglas = [x for x in SIGLA.findall(endereco or '') if x in UF]
    if not siglas:
        siglas = [x for x in SIGLA.findall(local_busca or '') if x in UF]
    return (''.join(postal[-1]) if postal else '', siglas[-1] if siglas else '')


def main() -> None:
    pasta = Path('dados')
    estado = json.loads((pasta / 'recuperacao_emails.json').read_text(encoding='utf-8'))
    escopo = {lead['chave'] for lead in estado['leads']}
    if len(escopo) != 12298:
        raise ValueError('A lista original deve conter exatamente 12.298 leads distintos.')
    encontrados = set()
    fila = []
    for lead in Supabase().listar('chave,nome,endereco,local_busca,telefone,emails'):
        chave = lead['chave']
        if chave not in escopo:
            continue
        encontrados.add(chave)
        if emails_publicos(lead.get('emails') or ''):
            continue
        cep, uf = localizacao(lead.get('endereco') or '', lead.get('local_busca') or '')
        if cep and uf:
            fila.append({campo: lead.get(campo) or '' for campo in
                         ('chave', 'nome', 'endereco', 'telefone')} | {'cep': cep, 'uf': uf})
    if encontrados != escopo:
        raise ValueError('Nem todos os leads originais estão acessíveis no Supabase.')
    destino = pasta / 'fila_cnpj_sem_email.json'
    destino.write_text(json.dumps(fila, ensure_ascii=False), encoding='utf-8')
    print(f'{len(fila)} leads sem e-mail têm CEP e UF para cruzamento cadastral.')


if __name__ == '__main__':
    main()
