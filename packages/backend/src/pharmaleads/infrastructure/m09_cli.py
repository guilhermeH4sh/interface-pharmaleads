"""Enfileiramento explícito M09, nunca acionado automaticamente pelo M08."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime

from pharmaleads.domain.crawling.browser import JOB_KIND, REQUIRED_REASON, SOURCE_ID
from pharmaleads.domain.jobs.models import JobRequest
from pharmaleads.domain.jobs.queue import JobQueue
from pharmaleads.domain.sites.models import SiteState
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.infrastructure.site_data_api import SiteDataApiError, SiteDataApiRepository

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Enfileira M09 somente após decisão humana.")
    parser.add_argument("--lead-id", type=int, required=True)
    parser.add_argument("--reason", choices=(REQUIRED_REASON,), required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    if not args.apply:
        print("M09 dry-run: informe --apply após confirmar que o HTTP não renderizou a página.")
        return 0
    if args.lead_id < 1 or os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("M09 bloqueado: lead ou liberação operacional inválida.", file=sys.stderr)
        return 2
    key, token = os.getenv(KEY_ENV), os.getenv(TOKEN_ENV)
    if not key or not token:
        print("M09 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        backend = DataApiJobBackend(key, token)
        site = SiteDataApiRepository(key, token).get(args.lead_id)
        previous = backend.by_id(args.lead_id)
        if site is None or site.state != SiteState.CONFIRMED or site.final_url is None:
            raise ValueError("Lead não possui site confirmado no M07.")
        if (
            previous is None
            or previous.kind != "crawl_http"
            or previous.checkpoint.get("finish_reason") != "finished"
        ):
            raise ValueError("M09 exige coleta HTTP concluída antes da decisão humana.")
        counts: dict[str, int] = {}
        for item in previous.checkpoint.get("observations", []):
            if isinstance(item, dict) and isinstance(item.get("kind"), str):
                key_name = item["kind"]
                counts[key_name] = counts.get(key_name, 0) + 1
        request = JobRequest.create(
            site.cnpj,
            JOB_KIND,
            {
                "browser_reason": args.reason,
                "http_contact_counts": counts,
                "site_review_version": site.version,
                "source_id": SOURCE_ID,
            },
        )
        job, duplicate = JobQueue(backend).enqueue(request, datetime.now(UTC))
        print(
            json.dumps(
                {"deduplicated": duplicate, "job_id": str(job.job_id), "state": job.state},
                sort_keys=True,
            )
        )
        return 0
    except (JobDataApiError, SiteDataApiError, ValueError) as exc:
        print(f"M09 bloqueado: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
