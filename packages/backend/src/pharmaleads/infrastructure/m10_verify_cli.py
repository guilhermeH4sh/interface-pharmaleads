"""Prova concorrente CAS da revisão de contatos M10."""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from threading import Barrier
from typing import Protocol

from pharmaleads.domain.contacts.service import review_records
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.contact_data_api import (
    ContactDataApiError,
    ContactDataApiRepository,
    ContactRow,
)
from pharmaleads.infrastructure.m10_cli import APPROVAL_ENV, KEY_ENV, TOKEN_ENV
from pharmaleads.infrastructure.m10_review_cli import actor_from_token, source_ids


class M10VerificationError(RuntimeError):
    """Falha sanitizada da prova remota M10."""


class ContactReviewRepository(Protocol):
    def get(self, lead_id: int) -> ContactRow | None: ...

    def save(
        self,
        row: ContactRow,
        records: tuple[dict[str, object], ...],
        evidence: tuple[dict[str, object], ...],
        *,
        actor: str,
    ) -> ContactRow: ...


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Prova concorrente da revisão CAS M10.")
    root.add_argument("--lead-id", type=int, required=True)
    root.add_argument("--contact-id", required=True)
    root.add_argument("--apply", action="store_true")
    return root


def _decision(records: tuple[dict[str, object], ...], contact_id: str) -> str:
    for record in records:
        if record.get("id") == contact_id:
            decision = record.get("review_state")
            if decision in {"approved", "rejected"}:
                return str(decision)
            raise M10VerificationError("Contato ainda não possui decisão humana.")
    raise M10VerificationError("Contato remoto não localizado.")


def verify(
    repository: ContactReviewRepository,
    registry: SourcePolicyRegistry,
    lead_id: int,
    contact_id: str,
    actor: str,
) -> dict[str, object]:
    if lead_id < 1 or not contact_id or not actor:
        raise M10VerificationError("Parâmetros da prova inválidos.")
    current = repository.get(lead_id)
    if current is None:
        raise M10VerificationError("Lead remoto não localizado.")
    decision = _decision(current.records, contact_id)
    engine = registry.snapshot()
    for source_id in source_ids(current.records):
        engine.check_or_raise(source_id, "contact_records", PolicyAction.PERSISTIR)
    barrier = Barrier(2)

    def compete() -> bool:
        revised = review_records(
            current.records,
            {contact_id},
            decision,
            actor,
            datetime.now(UTC).isoformat(),
        )
        barrier.wait(timeout=10)
        try:
            repository.save(current, revised, current.evidence, actor=actor)
        except ContactDataApiError:
            return False
        return True

    with ThreadPoolExecutor(max_workers=2) as pool:
        winners = list(pool.map(lambda _: compete(), range(2)))
    if winners.count(True) != 1:
        raise M10VerificationError("Disputa remota não produziu exatamente um vencedor.")
    final = repository.get(lead_id)
    if final is None or final.review_version != current.review_version + 1:
        raise M10VerificationError("Versão final da revisão não foi comprovada.")
    if _decision(final.records, contact_id) != decision:
        raise M10VerificationError("Decisão final do contato diverge.")
    return {
        "contact_id": contact_id,
        "final_version": final.review_version,
        "lead_id": lead_id,
        "reviews_started": 2,
        "reviews_won": 1,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not args.apply:
        print(json.dumps({"lead_id": args.lead_id, "mode": "dry-run", "writes": 0}))
        return 0
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("Teste M10 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Teste M10 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        result = verify(
            ContactDataApiRepository(key, token),
            SourcePolicyRegistry(),
            args.lead_id,
            args.contact_id,
            actor_from_token(token),
        )
    except (ContactDataApiError, M10VerificationError, ValueError) as exc:
        print(f"Teste M10 falhou: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
