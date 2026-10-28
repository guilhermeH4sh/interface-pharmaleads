"""Worker M09 one-shot; processo separado da API e do worker Scrapy."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime

from pharmaleads.domain.crawling.browser import JOB_KIND
from pharmaleads.domain.jobs.queue import JobQueue, QueueConflictError
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.infrastructure.m09_runner import run_job
from pharmaleads.infrastructure.site_data_api import SiteDataApiError, SiteDataApiRepository


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Worker M09 one-shot para browser seletivo.")
    parser.add_argument("--worker-id", required=True)
    args = parser.parse_args(argv)
    if os.getenv("PHARMALEADS_TABLE_WRITE_APPROVED") != "public.pharmaleads":
        print("Worker M09 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv("PHARMALEADS_DATA_API_PUBLISHABLE_KEY")
    token = os.getenv("PHARMALEADS_DATA_API_ACCESS_TOKEN")
    if not key or not token:
        print("Worker M09 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        queue = JobQueue(DataApiJobBackend(key, token))
        queue.recover_expired(datetime.now(UTC))
        job = queue.claim_kind(args.worker_id, JOB_KIND, datetime.now(UTC))
        if job is None:
            print("Worker M09: nenhum job disponível.")
            return 0
        run_job(queue, SiteDataApiRepository(key, token), SourcePolicyRegistry(), job)
    except (JobDataApiError, SiteDataApiError, QueueConflictError, ValueError) as exc:
        print(f"Worker M09 interrompido: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
