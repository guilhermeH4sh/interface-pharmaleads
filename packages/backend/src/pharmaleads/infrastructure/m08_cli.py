"""Enfileiramento explícito da coleta institucional M08."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from typing import Any

from pharmaleads.domain.crawling.service import JOB_KIND, SOURCE_ID
from pharmaleads.domain.jobs.models import JobRecord, JobRequest, JobState
from pharmaleads.domain.jobs.queue import (
    ExpectedState,
    JobBackend,
    JobQueue,
    QueueConflictError,
    QueueNotFoundError,
)
from pharmaleads.domain.sites.models import SiteState
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.infrastructure.site_data_api import SiteDataApiError, SiteDataApiRepository

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Enfileira M08 somente para site confirmado.")
    root.add_argument("--lead-id", type=int, required=True)
    mode = root.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--status", action="store_true")
    mode.add_argument("--repair-status", action="store_true")
    return root


def status_payload(job: JobRecord) -> dict[str, Any]:
    observations = job.checkpoint.get("observations", [])
    counts: dict[str, int] = {}
    if isinstance(observations, list):
        for item in observations:
            if isinstance(item, dict) and isinstance(item.get("kind"), str):
                kind = str(item["kind"])
                counts[kind] = counts.get(kind, 0) + 1
    metrics = job.checkpoint.get("metrics", {})
    return {
        "attempts": job.attempt,
        "contact_counts": counts,
        "error_code": job.error_code,
        "finish_reason": job.checkpoint.get("finish_reason"),
        "lead_id": job.lead_id,
        "metrics": metrics if isinstance(metrics, dict) else {},
        "state": job.state,
    }


def repair_succeeded_error(
    backend: JobBackend,
    lead_id: int,
    now: datetime,
) -> tuple[JobRecord, bool]:
    job = backend.by_id(lead_id)
    if job is None:
        raise ValueError("Lead não localizado.")
    if job.state != JobState.SUCCEEDED:
        raise ValueError("Reparo permitido somente para job concluído com sucesso.")
    if job.error_code is None:
        return job, False
    updated = backend.compare_and_set(
        lead_id,
        ExpectedState(JobState.SUCCEEDED, job.fence),
        {"error_code": None, "updated_at": now},
        now,
    )
    if updated is None:
        raise QueueConflictError("Reparo do estado final perdeu a concorrência.")
    return updated, True


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not args.apply and not args.status and not args.repair_status:
        print("M08 dry-run: use --apply para enfileirar após revisar o lead.")
        return 0
    if args.lead_id < 1 or os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("M08 bloqueado: lead ou liberação operacional inválida.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("M08 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        backend = DataApiJobBackend(key, token)
        if args.repair_status:
            job, repaired = repair_succeeded_error(backend, args.lead_id, datetime.now(UTC))
            payload = {"repaired": repaired, **status_payload(job)}
            print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
            return 0
        if args.status:
            status_job = backend.by_id(args.lead_id)
            if status_job is None:
                raise ValueError("Lead não localizado.")
            print(json.dumps(status_payload(status_job), ensure_ascii=False, sort_keys=True))
            return 0
        sites = SiteDataApiRepository(key, token)
        site = sites.get(args.lead_id)
        if site is None or site.state != SiteState.CONFIRMED or site.final_url is None:
            raise ValueError("Lead não possui site confirmado no M07.")
        request = JobRequest.create(
            site.cnpj,
            JOB_KIND,
            {"source_id": SOURCE_ID, "site_review_version": site.version},
        )
        job, deduplicated = JobQueue(backend).enqueue(
            request,
            datetime.now(UTC),
        )
        print(
            json.dumps(
                {
                    "deduplicated": deduplicated,
                    "job_id": str(job.job_id),
                    "lead_id": job.lead_id,
                    "state": job.state,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except (
        JobDataApiError,
        SiteDataApiError,
        QueueConflictError,
        QueueNotFoundError,
        ValueError,
    ) as exc:
        print(f"M08 bloqueado: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
