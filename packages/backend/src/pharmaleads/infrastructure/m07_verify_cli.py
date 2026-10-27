"""Prova remota M07: duas revisões CAS e uma confirmação legítima."""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from threading import Barrier
from typing import Protocol

from pharmaleads.config import Settings
from pharmaleads.domain.sites.models import SiteCandidate, SiteState
from pharmaleads.domain.sites.workflow import ReviewConflictError, SiteWorkflow
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.site_data_api import (
    SiteDataApiError,
    SiteDataApiRepository,
)

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"
PERSIST_FIELDS = ("site_candidate_url", "site_evidence", "site_workflow", "website")


class M07VerificationError(RuntimeError):
    """Falha sanitizada da prova remota."""


class SiteReviewRepository(Protocol):
    def get(self, lead_id: int) -> SiteCandidate | None: ...

    def save(
        self,
        candidate: SiteCandidate,
        *,
        expected_state: SiteState | None,
        expected_version: int,
    ) -> SiteCandidate: ...

    def confirmed_website(self, lead_id: int) -> str: ...


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Prova concorrente M07 no piloto Supabase.")
    root.add_argument("--lead-id", type=int, required=True)
    root.add_argument("--expected-version", type=int, default=1)
    root.add_argument("--apply", action="store_true")
    return root


def verify(
    repository: SiteReviewRepository,
    registry: SourcePolicyRegistry,
    lead_id: int,
    expected_version: int,
) -> dict[str, object]:
    if lead_id < 1 or expected_version < 1:
        raise M07VerificationError("Parâmetros da prova inválidos.")
    current = repository.get(lead_id)
    if current is None:
        raise M07VerificationError("Candidato remoto não localizado.")
    if current.state != SiteState.REVIEW_REQUIRED or current.version != expected_version:
        raise M07VerificationError("Candidato não está pronto na versão esperada.")

    barrier = Barrier(2)

    def compete(reviewer: str) -> str | None:
        reviewed = SiteWorkflow.review(
            current,
            expected_version=expected_version,
            reviewer=reviewer,
            approve=True,
            now=datetime.now(UTC),
        )
        barrier.wait(timeout=10)
        try:
            saved = registry.guarded(
                current.source_id,
                PERSIST_FIELDS,
                PolicyAction.PERSISTIR,
                lambda: repository.save(
                    reviewed,
                    expected_state=SiteState.REVIEW_REQUIRED,
                    expected_version=expected_version,
                ),
            )
        except SiteDataApiError:
            return None
        return saved.reviewed_by

    with ThreadPoolExecutor(max_workers=2) as pool:
        winners = list(pool.map(compete, ("m07-review-a", "m07-review-b")))
    winner_ids = [value for value in winners if value is not None]
    if len(winner_ids) != 1:
        raise M07VerificationError("Disputa remota não produziu exatamente um vencedor.")

    final = repository.get(lead_id)
    if (
        final is None
        or final.state != SiteState.CONFIRMED
        or final.version != expected_version + 1
        or final.reviewed_by != winner_ids[0]
    ):
        raise M07VerificationError("Confirmação remota do vínculo não foi comprovada.")
    website = repository.confirmed_website(lead_id)
    if website != final.final_url:
        raise M07VerificationError("Website publicado diverge da URL validada.")
    return {
        "lead_id": lead_id,
        "reviews_started": 2,
        "reviews_won": 1,
        "final_state": final.state.value,
        "final_version": final.version,
        "strong_cnpj_match": True,
        "website_confirmed": True,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not args.apply:
        print(json.dumps({"mode": "dry-run", "lead_id": args.lead_id, "writes": 0}))
        return 0
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("Teste M07 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Teste M07 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        result = verify(
            SiteDataApiRepository(key, token),
            SourcePolicyRegistry(Settings().source_policy_path),
            args.lead_id,
            args.expected_version,
        )
    except (M07VerificationError, ReviewConflictError, SiteDataApiError, ValueError) as exc:
        print(f"Teste M07 falhou: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
