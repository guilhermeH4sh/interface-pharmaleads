"""Monta a fila local de sites dos leads originais ainda sem e-mail público."""
import json
from collections import Counter
from pathlib import Path

from pharmaleads.buscar_emails_sites import normalizar
from pharmaleads.enriquecedor import emails_publicos
from pharmaleads.supabase import Supabase


def main() -> None:
    pasta = Path('dados')
    estado = json.loads((pasta / 'recuperacao_emails.json').read_text(encoding='utf-8'))
    escopo = {lead['chave'] for lead in estado['leads']}
    if len(escopo) != 12298:
        raise ValueError('A lista original deve conter exatamente 12.298 leads distintos.')
    registros = [lead for lead in Supabase().listar('chave,nome,endereco,site,emails')
                 if lead['chave'] in escopo]
    if len(registros) != len(escopo):
        raise ValueError('Nem todos os leads originais estão acessíveis no Supabase.')
    sites = Counter(normalizar(lead.get('site') or '') for lead in registros)
    fila = []
    for lead in registros:
        site = normalizar(lead.get('site') or '')
        if site and sites[site] == 1 and not emails_publicos(lead.get('emails') or ''):
            fila.append({campo: lead[campo] for campo in ('chave', 'nome', 'endereco')}
                        | {'site': site})
    destino = pasta / 'fila_playwright_emails.json'
    destino.write_text(json.dumps(fila, ensure_ascii=False), encoding='utf-8')
    print(f'{len(fila)} sites únicos de leads existentes sem e-mail público na fila.')


if __name__ == '__main__':
    main()
