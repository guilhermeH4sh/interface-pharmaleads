"""Aguarda o supervisor antigo encerrar e inicia a versão com escopo dinâmico."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from pharmaleads import config
from pharmaleads.supervisionar_emails import buscar_ativo


def main() -> int:
    trava = config.pasta_dados() / 'supervisor_recuperacao.json'
    while buscar_ativo(trava):
        time.sleep(30)
    return subprocess.call([
        sys.executable, '-u', '-m', 'pharmaleads.supervisionar_emails',
        '--estado', str(config.pasta_dados() / 'recuperacao_emails.json'),
        '--espera', '30',
    ])


if __name__ == '__main__':
    raise SystemExit(main())
