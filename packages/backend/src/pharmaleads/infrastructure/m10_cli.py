"""Promoção controlada M10 de observações para contatos revisáveis."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Callable

from pharmaleads.domain.contacts.service import (
    checkpoint_records,
    evidence_records,
    preserve_reviews,
)
from pharmaleads.domain.crawling.models import ObservationCandidate
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.contact_data_api import (
    ContactDataApiError,
    ContactDataApiRepository,
)

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"
CONTACT_SOURCES = {"confirmed_site_http", "confirmed_site_browser"}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Consolida observações M08/M09 no lead revisável.")
    root.add_argument("--lead-id", type=int, required=True)
    root.add_argument("--apply", action="store_true")
    return root


def observations(checkpoint: dict[str, object], lead_id: int) -> tuple[ObservationCandidate, ...]:
    values = checkpoint.get("observations", [])
    if not isinstance(values, list):
        raise ValueError("Observações de contato inválidas.")
    parsed = tuple(ObservationCandidate.from_checkpoint(value) for value in values)
    if any(value.lead_id != lead_id for value in parsed):
        raise ValueError("Observação pertence a outro lead.")
    if any(value.source_id not in CONTACT_SOURCES for value in parsed):
        raise ValueError("Fonte de observação não autorizada para M10.")
    return parsed


def guarded_persist[T](
    registry: SourcePolicyRegistry,
    source_ids: tuple[str, ...],
    operation: Callable[[], T],
) -> T:
    if not source_ids:
        raise ValueError("Nenhuma observação disponível para consolidação.")
    source_id, *remaining = source_ids
    return registry.guarded(
        source_id,
        ("contact_records", "contact_evidence"),
        PolicyAction.PERSISTIR,
        lambda: guarded_persist(registry, tuple(remaining), operation)
        if remaining
        else operation(),
    )


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.lead_id < 1:
        print("M10 bloqueado: lead inválido.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("M10 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    if args.apply and os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("M10 bloqueado: liberação operacional inválida.", file=sys.stderr)
        return 2
    try:
        repository = ContactDataApiRepository(key, token)
        row = repository.get(args.lead_id)
        if row is None:
            raise ValueError("Lead não localizado.")
        found = observations(row.checkpoint, row.lead_id)
        records = preserve_reviews(checkpoint_records(found), row.records)
        evidence = evidence_records(found)
        source_ids = tuple(sorted({value.source_id for value in found}))
        if args.apply:
            saved = guarded_persist(
                SourcePolicyRegistry(),
                source_ids,
                lambda: repository.save(row, records, evidence, actor="m10-consolidator"),
            )
            version = saved.review_version
        else:
            version = row.review_version
        print(
            json.dumps(
                {
                    "applied": args.apply,
                    "contact_records": len(records),
                    "contact_ids": [record["id"] for record in records],
                    "evidence_records": len(evidence),
                    "lead_id": row.lead_id,
                    "review_version": version,
                    "sources": list(source_ids),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except (ContactDataApiError, ValueError) as exc:
        print(f"M10 bloqueado: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
