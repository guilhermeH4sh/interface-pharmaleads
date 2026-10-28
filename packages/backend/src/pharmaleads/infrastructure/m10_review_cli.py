"""Revisão humana versionada dos contatos consolidados no M10."""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from datetime import UTC, datetime

from pharmaleads.domain.contacts.service import review_records
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.contact_data_api import (
    ContactDataApiError,
    ContactDataApiRepository,
)
from pharmaleads.infrastructure.m10_cli import APPROVAL_ENV, KEY_ENV, TOKEN_ENV


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Revisa contatos M10 por identificador estável.")
    root.add_argument("--lead-id", type=int, required=True)
    root.add_argument("--contact-id", action="append", required=True)
    root.add_argument("--decision", choices=("approved", "rejected"), required=True)
    root.add_argument("--apply", action="store_true")
    return root


def actor_from_token(token: str) -> str:
    try:
        payload = token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        subject = json.loads(base64.urlsafe_b64decode(padded)).get("sub")
    except (IndexError, ValueError, UnicodeError):
        raise ValueError("Token de acesso inválido.") from None
    if not isinstance(subject, str) or not subject:
        raise ValueError("Token de acesso inválido.")
    return subject


def source_ids(records: tuple[dict[str, object], ...]) -> tuple[str, ...]:
    sources: set[str] = set()
    for record in records:
        values = record.get("sources")
        if isinstance(values, list):
            sources.update(source for source in values if isinstance(source, str))
    if not sources:
        raise ValueError("Contatos sem fonte não podem ser revisados.")
    return tuple(sorted(sources))


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.lead_id < 1 or not args.contact_id:
        print("M10 bloqueado: revisão inválida.", file=sys.stderr)
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
        actor = actor_from_token(token)
        revised = review_records(
            row.records,
            set(args.contact_id),
            args.decision,
            actor,
            datetime.now(UTC).isoformat(),
        )
        if args.apply:
            engine = SourcePolicyRegistry().snapshot()
            for source_id in source_ids(row.records):
                engine.check_or_raise(source_id, "contact_records", PolicyAction.PERSISTIR)
            saved = repository.save(row, revised, row.evidence, actor=actor)
            version = saved.review_version
        else:
            version = row.review_version
        print(
            json.dumps(
                {
                    "applied": args.apply,
                    "decision": args.decision,
                    "lead_id": row.lead_id,
                    "review_version": version,
                    "reviewed_contacts": len(args.contact_id),
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
