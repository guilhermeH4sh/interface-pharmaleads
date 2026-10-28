"""Worker M09 separado: navegador somente para job explicitamente aprovado."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from pharmaleads.domain.crawling.browser import JOB_KIND, REQUIRED_REASON, SOURCE_ID, browser_egress
from pharmaleads.domain.jobs.models import JobRecord
from pharmaleads.domain.jobs.queue import JobQueue
from pharmaleads.domain.sites.models import SiteState
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.m09_browser import BrowserCollectionError, collect_with_playwright
from pharmaleads.infrastructure.site_data_api import SiteDataApiRepository


def run_job(
    queue: JobQueue,
    sites: SiteDataApiRepository,
    registry: SourcePolicyRegistry,
    job: JobRecord,
) -> None:
    if job.kind != JOB_KIND or job.payload.get("source_id") != SOURCE_ID:
        raise ValueError("Job não pertence ao navegador M09.")
    if job.payload.get("browser_reason") != REQUIRED_REASON:
        raise ValueError("M09 exige decisão humana de página dinâmica.")
    site = sites.get(job.lead_id)
    if (
        site is None
        or site.state != SiteState.CONFIRMED
        or site.final_url is None
        or job.payload.get("site_review_version") != site.version
    ):
        raise ValueError("Site confirmado mudou antes do navegador M09.")
    registry.guarded(
        SOURCE_ID,
        ("site_page", "email", "telefone", "whatsapp"),
        PolicyAction.COLETAR,
        lambda: None,
    )
    try:
        result = asyncio.run(
            collect_with_playwright(
                egress=browser_egress(site.final_url),
                lead_id=job.lead_id,
                source_url=site.final_url,
                observed_at=datetime.now(UTC),
            )
        )
    except BrowserCollectionError:
        queue.fail(job, "browser_collection_error", datetime.now(UTC))
        return
    registry.guarded(SOURCE_ID, ("job_checkpoint",), PolicyAction.PERSISTIR, lambda: None)
    checkpoint: dict[str, Any] = {
        "browser_contact_counts": {
            kind: sum(item.kind.value == kind for item in result.extraction.observations)
            for kind in ("email", "telefone", "whatsapp")
        },
        "browser_html_bytes": result.html_bytes,
        "browser_requests_allowed": result.requests_allowed,
        "browser_requests_blocked": result.requests_blocked,
        "finish_reason": "finished",
        "http_contact_counts": job.payload.get("http_contact_counts", {}),
        "observations": [item.checkpoint() for item in result.extraction.observations],
        "source_id": SOURCE_ID,
    }
    queue.complete(job, checkpoint, datetime.now(UTC))
