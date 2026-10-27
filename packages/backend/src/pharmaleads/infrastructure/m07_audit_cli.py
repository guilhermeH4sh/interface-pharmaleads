"""Auditoria somente leitura dos 100 leads do piloto após a confirmação M07."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from pharmaleads.config import Settings
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.site_data_api import (
    AUDIT_CORE_FIELDS,
    AUDIT_SITE_FIELDS,
    SiteDataApiError,
    SiteDataApiRepository,
)

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
EXPECTED_ROWS = 100
CORE_SOURCE = "receita_cnpj"
SITE_SOURCE = "manual_site_candidate"
EXPECTED_FIELDS = AUDIT_CORE_FIELDS[1:]
SITE_POLICY_FIELDS = ("website", "site_candidate_url", "site_evidence", "site_workflow")


class M07AuditError(RuntimeError):
    """Falha sanitizada da auditoria do piloto."""


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Audita os 100 leads do piloto M07.")
    root.add_argument("--expected-file", required=True, type=Path)
    root.add_argument("--confirmed-lead-id", required=True, type=int)
    root.add_argument("--confirmed-url", required=True)
    return root


def load_expected(path: Path) -> list[dict[str, str]]:
    if not path.is_file() or path.stat().st_size > 1_000_000:
        raise M07AuditError("Arquivo esperado ausente ou acima do limite.")
    rows: list[dict[str, str]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise M07AuditError("Arquivo esperado inválido.")
                record: dict[str, str] = {}
                for field in EXPECTED_FIELDS:
                    item = value.get(field)
                    if not isinstance(item, str):
                        raise M07AuditError("Arquivo esperado incompleto.")
                    record[field] = item
                rows.append(record)
    except (OSError, UnicodeError, ValueError) as exc:
        raise M07AuditError("Arquivo esperado inválido.") from exc
    if len(rows) != EXPECTED_ROWS:
        raise M07AuditError("Arquivo esperado não contém exatamente 100 leads.")
    return rows


def audit(
    expected: list[dict[str, str]],
    core_rows: list[dict[str, Any]],
    site_rows: list[dict[str, Any]],
    *,
    confirmed_lead_id: int,
    confirmed_url: str,
) -> dict[str, object]:
    expected_ids = list(range(1, len(expected) + 1))
    core_ids = [row.get("id") for row in core_rows]
    site_ids = [row.get("id") for row in site_rows]
    if core_ids != expected_ids or site_ids != expected_ids:
        raise M07AuditError("IDs remotos não correspondem ao piloto 1–100.")

    mismatches: list[int] = []
    for lead_id, (wanted, actual) in enumerate(zip(expected, core_rows, strict=True), start=1):
        if any(actual.get(field) != wanted[field] for field in EXPECTED_FIELDS):
            mismatches.append(lead_id)

    unexpected_sites: list[int] = []
    confirmed_ok = False
    for row in site_rows:
        lead_id = int(row["id"])
        if lead_id == confirmed_lead_id:
            confirmed_ok = (
                row.get("website") == confirmed_url
                and row.get("site_candidate_url") == confirmed_url
                and row.get("site_resolved_url") == confirmed_url
                and row.get("site_source_id") == SITE_SOURCE
                and row.get("site_state") == "confirmed"
                and row.get("site_link_kind") == "branch_exact"
                and row.get("site_review_version") == 2
                and isinstance(row.get("site_evidence"), dict)
                and bool(row.get("site_evidence"))
                and isinstance(row.get("site_reviewed_by"), str)
                and row.get("site_reviewed_at") is not None
                and row.get("site_updated_at") is not None
            )
            continue
        if (
            row.get("website") is not None
            or row.get("site_candidate_url") is not None
            or row.get("site_resolved_url") is not None
            or row.get("site_source_id") is not None
            or row.get("site_state") is not None
            or row.get("site_link_kind") is not None
            or row.get("site_evidence") != {}
            or row.get("site_review_version") != 0
            or row.get("site_reviewed_by") is not None
            or row.get("site_reviewed_at") is not None
            or row.get("site_updated_at") is not None
        ):
            unexpected_sites.append(lead_id)

    if mismatches or unexpected_sites or not confirmed_ok:
        raise M07AuditError(
            "Auditoria encontrou divergência "
            f"(cadastro_ids={mismatches}; site_ids={unexpected_sites}; "
            f"confirmado={confirmed_ok})."
        )
    return {
        "rows_expected": len(expected),
        "rows_remote": len(core_rows),
        "core_rows_exact": len(expected),
        "core_mismatches": 0,
        "confirmed_lead_id": confirmed_lead_id,
        "confirmed_site_rows": 1,
        "untouched_site_rows": len(expected) - 1,
        "unexpected_site_rows": 0,
        "writes": 0,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Auditoria M07 bloqueada: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        expected = load_expected(args.expected_file)
        repository = SiteDataApiRepository(key, token)
        registry = SourcePolicyRegistry(Settings().source_policy_path)
        core_rows = registry.guarded(
            CORE_SOURCE,
            EXPECTED_FIELDS,
            PolicyAction.COLETAR,
            lambda: repository.audit_rows(AUDIT_CORE_FIELDS),
        )
        site_rows = registry.guarded(
            SITE_SOURCE,
            SITE_POLICY_FIELDS,
            PolicyAction.COLETAR,
            lambda: repository.audit_rows(AUDIT_SITE_FIELDS),
        )
        result = audit(
            expected,
            core_rows,
            site_rows,
            confirmed_lead_id=args.confirmed_lead_id,
            confirmed_url=args.confirmed_url,
        )
    except (M07AuditError, SiteDataApiError, ValueError) as exc:
        print(f"Auditoria M07 falhou: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
