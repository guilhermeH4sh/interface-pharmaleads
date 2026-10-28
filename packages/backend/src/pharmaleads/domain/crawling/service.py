"""Fronteira M08 entre fila, site confirmado e política de fonte."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from pharmaleads.domain.jobs.models import JobRecord
from pharmaleads.domain.sites.models import SiteCandidate, SiteState
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry

SOURCE_ID = "confirmed_site_http"
JOB_KIND = "crawl_http"
COLLECT_FIELDS = ("site_page", "email", "telefone", "whatsapp")


class ConfirmedSiteRepository(Protocol):
    def get(self, lead_id: int) -> SiteCandidate | None: ...

    def confirmed_website(self, lead_id: int) -> str: ...


@dataclass(frozen=True)
class CrawlPlan:
    lead_id: int
    cnpj: str
    start_url: str
    site_review_version: int
    resume: dict[str, object]


def prepare_crawl(
    job: JobRecord,
    sites: ConfirmedSiteRepository,
    registry: SourcePolicyRegistry,
) -> CrawlPlan:
    if job.kind != JOB_KIND:
        raise ValueError("Job não pertence ao coletor institucional M08.")
    candidate = sites.get(job.lead_id)
    if (
        candidate is None
        or candidate.state != SiteState.CONFIRMED
        or candidate.cnpj != job.cnpj
        or candidate.final_url is None
    ):
        raise ValueError("Job M08 não possui site confirmado compatível.")
    version = job.payload.get("site_review_version")
    source_id = job.payload.get("source_id")
    if type(version) is not int or version != candidate.version or source_id != SOURCE_ID:
        raise ValueError("Job M08 ficou obsoleto após revisão do site.")
    published_url = sites.confirmed_website(job.lead_id)
    if published_url != candidate.final_url:
        raise ValueError("URL publicada diverge do site confirmado.")
    registry.guarded(SOURCE_ID, COLLECT_FIELDS, PolicyAction.COLETAR, lambda: None)
    return CrawlPlan(
        lead_id=job.lead_id,
        cnpj=job.cnpj,
        start_url=published_url,
        site_review_version=candidate.version,
        resume=dict(job.checkpoint),
    )


def authorize_checkpoint(
    plan: CrawlPlan,
    sites: ConfirmedSiteRepository,
    registry: SourcePolicyRegistry,
) -> None:
    current = sites.get(plan.lead_id)
    if (
        current is None
        or current.state != SiteState.CONFIRMED
        or current.cnpj != plan.cnpj
        or current.version != plan.site_review_version
        or current.final_url != plan.start_url
        or sites.confirmed_website(plan.lead_id) != plan.start_url
    ):
        raise ValueError("Site mudou durante o crawl; checkpoint recusado.")
    registry.guarded(
        SOURCE_ID,
        ("job_checkpoint",),
        PolicyAction.PERSISTIR,
        lambda: None,
    )
