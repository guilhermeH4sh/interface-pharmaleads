"""Worker M08: um reactor Scrapy por processo, sem reinicialização inválida."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime

from scrapy.utils.reactor import install_reactor

from pharmaleads.domain.jobs.queue import JobQueue, QueueConflictError
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.infrastructure.site_data_api import SiteDataApiError, SiteDataApiRepository

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"
SELECT_REACTOR = "twisted.internet.selectreactor.SelectReactor"


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        description="Worker M08 one-shot para sites confirmados em public.pharmaleads."
    )
    root.add_argument("--worker-id", required=True)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("Worker M08 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Worker M08 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        install_reactor(SELECT_REACTOR)
        queue = JobQueue(DataApiJobBackend(key, token))
        sites = SiteDataApiRepository(key, token)
        registry = SourcePolicyRegistry()
        queue.recover_expired(datetime.now(UTC))
        job = queue.claim_kind(args.worker_id, "crawl_http", datetime.now(UTC))
        if job is None:
            print("Worker M08: nenhum job disponível.")
            return 0
        from pharmaleads.infrastructure.m08_runner import run_reactor

        run_reactor(queue, sites, registry, job)
    except (JobDataApiError, SiteDataApiError, QueueConflictError, ValueError) as exc:
        print(f"Worker M08 interrompido: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
