"""Executa as rodadas num One-Off Job separado do serviço web."""
from __future__ import annotations

import json
import signal
import sys

from .config import ErroPharmaLeads
from .render_jobs import MARCADOR_JOB, decodificar_entrada
from .render_service import ColetorRender


def registrar_progresso(estado: dict) -> None:
    campos = ('title', 'stage', 'round', 'completed_rounds', 'synced_leads',
              'found_leads', 'new_leads', 'with_email', 'without_email')
    print(MARCADOR_JOB + json.dumps({campo: estado[campo] for campo in campos if campo in estado}), flush=True)


def main() -> int:
    if len(sys.argv) != 2:
        print('Informe o argumento de configuração do job.', file=sys.stderr)
        return 2
    coletor = ColetorRender(ao_atualizar=registrar_progresso)
    signal.signal(signal.SIGTERM, lambda *_: coletor.solicitar_parada())
    signal.signal(signal.SIGINT, lambda *_: coletor.solicitar_parada())
    try:
        entrada = decodificar_entrada(sys.argv[1])
        return 0 if coletor.executar_job(entrada) == 'success' else 1
    except (ErroPharmaLeads, ValueError) as exc:
        print(f'Configuração do job inválida: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
