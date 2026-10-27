"""Transições concorrentes e bloqueio por padrão para revisão de sites."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from pharmaleads.domain.sites.linkage import LinkAssessment, LinkKind
from pharmaleads.domain.sites.models import SiteCandidate, SiteState
from pharmaleads.domain.sites.security import EgressTarget
from pharmaleads.shared.identifiers import normalize_cnpj


class ReviewConflictError(RuntimeError):
    """Versão ou transição de revisão inválida."""


class SiteWorkflow:
    @staticmethod
    def propose(
        lead_id: int,
        cnpj: str,
        source_id: str,
        target: EgressTarget,
    ) -> SiteCandidate:
        return SiteCandidate(
            lead_id=lead_id,
            cnpj=normalize_cnpj(cnpj),
            source_id=source_id.strip(),
            candidate_url=target.url,
            evidence={
                "resolved_addresses": list(target.addresses),
                "egress_port": target.port,
                "egress_scheme": target.scheme,
            },
        )

    @staticmethod
    def inspect(
        candidate: SiteCandidate,
        final_target: EgressTarget,
        assessment: LinkAssessment,
        *,
        redirect_count: int,
    ) -> SiteCandidate:
        if candidate.state != SiteState.CANDIDATE or assessment.target_cnpj != candidate.cnpj:
            raise ReviewConflictError("Candidato não pode ser inspecionado neste estado.")
        evidence: dict[str, Any] = {
            **candidate.evidence,
            "final_addresses": list(final_target.addresses),
            "observed_cnpjs": list(assessment.observed_cnpjs),
            "redirect_count": redirect_count,
        }
        return replace(
            candidate,
            final_url=final_target.url,
            state=SiteState.REVIEW_REQUIRED,
            link_kind=assessment.kind,
            evidence=evidence,
            version=candidate.version + 1,
        )

    @staticmethod
    def review(
        candidate: SiteCandidate,
        *,
        expected_version: int,
        reviewer: str,
        approve: bool,
        now: datetime,
    ) -> SiteCandidate:
        instant = now.astimezone(UTC) if now.tzinfo is not None else None
        if instant is None:
            raise ValueError("Revisão deve usar timezone.")
        if candidate.state != SiteState.REVIEW_REQUIRED or candidate.version != expected_version:
            raise ReviewConflictError("Revisão perdeu a concorrência ou estado mudou.")
        reviewer_id = reviewer.strip()
        if not reviewer_id or len(reviewer_id) > 128:
            raise ValueError("Revisor inválido.")
        if approve and candidate.link_kind != LinkKind.BRANCH_EXACT:
            raise ReviewConflictError("Confirmação exige CNPJ exato da filial.")
        return replace(
            candidate,
            state=SiteState.CONFIRMED if approve else SiteState.REJECTED,
            version=candidate.version + 1,
            reviewed_by=reviewer_id,
            reviewed_at=instant,
        )
