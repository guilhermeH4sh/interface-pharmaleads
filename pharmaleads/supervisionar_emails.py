"""Retoma a recuperação de e-mails após falhas transitórias do processo local."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

from . import config
from .config import ErroPharmaLeads
from .recuperar_emails import bloquear_estado


def progresso(caminho: Path) -> tuple[int, int]:
    estado = json.loads(caminho.read_text(encoding='utf-8'))
    leads = estado['leads']
    total = len(leads)
    consultados = estado['consultados']
    if total != 12298 or len({lead['chave'] for lead in leads}) != total or not 0 <= consultados <= total:
        raise ErroPharmaLeads('O escopo salvo não corresponde aos 12.298 leads originais.')
    return consultados, total


def buscar_ativo(caminho: Path) -> bool:
    try:
        with bloquear_estado(caminho):
            return False
    except ErroPharmaLeads:
        return True


def supervisionar(caminho: Path, espera: int) -> None:
    # Impede dois supervisores, além do bloqueio exclusivo da própria busca.
    with bloquear_estado(caminho.with_name('supervisor_recuperacao.json')):
        while True:
            consultados, total = progresso(caminho)
            if consultados == total:
                print(f'Busca concluída: {consultados}/{total}. Conferir cobertura no Supabase.', flush=True)
                return
            if buscar_ativo(caminho):
                time.sleep(espera)
                continue
            print(f'Retomando busca em {consultados}/{total}.', flush=True)
            codigo = subprocess.call([
                sys.executable, '-u', '-m', 'pharmaleads.recuperar_emails',
                '--estado', str(caminho), '--somente-sem-email', '--lote', '10',
                '--timeout-min', '5',
            ])
            print(f'Busca encerrada com código {codigo}; progresso salvo será conferido.', flush=True)
            time.sleep(espera)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--estado', type=Path, default=config.pasta_dados() / 'recuperacao_emails.json')
    parser.add_argument('--espera', type=int, default=60)
    args = parser.parse_args()
    if args.espera < 1:
        parser.error('A espera deve ser positiva.')
    try:
        supervisionar(args.estado, args.espera)
        return 0
    except (ErroPharmaLeads, OSError, ValueError, KeyError, TypeError) as erro:
        print(f'Supervisor interrompido: {erro}', flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
