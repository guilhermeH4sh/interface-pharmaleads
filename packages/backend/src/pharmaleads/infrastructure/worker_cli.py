"""Processo M06 separado da API, com handler sintético explícito."""

from __future__ import annotations

import argparse
import os
import sys
import time

from pharmaleads.domain.jobs.queue import JobQueue
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.worker import Worker, synthetic_probe

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Worker M06 restrito a public.pharmaleads.")
    root.add_argument("--worker-id", required=True)
    root.add_argument("--once", action="store_true")
    root.add_argument("--poll-seconds", type=float, default=2.0)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not 0.2 <= args.poll_seconds <= 60:
        print("Worker M06 bloqueado: intervalo de polling inválido.", file=sys.stderr)
        return 2
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("Worker M06 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Worker M06 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        queue = JobQueue(DataApiJobBackend(key, token))
        worker = Worker(args.worker_id, queue, {"synthetic_probe": synthetic_probe})
        while True:
            worked = worker.run_once()
            if args.once:
                return 0
            if not worked:
                time.sleep(args.poll_seconds)
    except (JobDataApiError, ValueError) as exc:
        print(f"Worker M06 interrompido: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
