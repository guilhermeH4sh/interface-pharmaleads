"""CLI M07: validar, propor e revisar candidatos sem busca nacional implícita."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from pharmaleads.config import Settings
from pharmaleads.domain.sites.candidates import CandidateFileError, read_candidate_csv
from pharmaleads.domain.sites.models import SiteState
from pharmaleads.domain.sites.security import UrlSecurityError, plan_egress
from pharmaleads.domain.sites.workflow import ReviewConflictError, SiteWorkflow
from pharmaleads.domain.source_policy.engine import PolicyViolationError
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import (
    CatalogConfigurationError,
    SourcePolicyRegistry,
)
from pharmaleads.infrastructure.site_data_api import (
    SiteDataApiError,
    SiteDataApiRepository,
)
from pharmaleads.infrastructure.site_http import (
    InspectionResult,
    SafeSiteInspector,
    SiteInspectionError,
)

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"
DEFAULT_SOURCE = "manual_site_candidate"
PERSIST_FIELDS = ("site_candidate_url", "site_evidence", "site_workflow")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="M07: candidatos de sites com SSRF e revisão.")
    commands = root.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validar", help="Inspeciona uma URL sem gravar.")
    validate.add_argument("--cnpj", required=True)
    validate.add_argument("--url", required=True)
    validate.add_argument("--source-id", default=DEFAULT_SOURCE)

    validate_file = commands.add_parser(
        "validar-arquivo", help="Valida CSV de candidatos sem acessar os sites."
    )
    validate_file.add_argument("--file", required=True, type=Path)

    propose = commands.add_parser("propor", help="Valida e prepara candidato para revisão.")
    propose.add_argument("--lead-id", required=True, type=int)
    propose.add_argument("--cnpj", required=True)
    propose.add_argument("--url", required=True)
    propose.add_argument("--source-id", default=DEFAULT_SOURCE)
    propose.add_argument("--apply", action="store_true")

    review = commands.add_parser("revisar", help="Confirma ou rejeita candidato inspecionado.")
    review.add_argument("--lead-id", required=True, type=int)
    review.add_argument("--expected-version", required=True, type=int)
    review.add_argument("--reviewer", required=True)
    review.add_argument("--decision", choices=("approve", "reject"), required=True)
    review.add_argument("--apply", action="store_true")
    return root


def _registry() -> SourcePolicyRegistry:
    return SourcePolicyRegistry(Settings().source_policy_path)


def _credentials() -> tuple[str, str]:
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        raise SiteDataApiError("Liberação operacional ausente.")
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        raise SiteDataApiError("Credenciais de processo ausentes.")
    return key, token


def _inspect(
    registry: SourcePolicyRegistry,
    source_id: str,
    url: str,
    cnpj: str,
) -> InspectionResult:
    return registry.guarded(
        source_id,
        ("website",),
        PolicyAction.COLETAR,
        lambda: SafeSiteInspector().inspect(url, cnpj),
    )


def _safe_result(result: InspectionResult) -> dict[str, object]:
    return {
        "final_url": result.final_target.url,
        "http_status": result.status,
        "link_kind": result.assessment.kind.value,
        "redirects": len(result.redirect_chain),
        "strong_cnpj_match": result.assessment.strong,
    }


def _validate_command(
    args: argparse.Namespace, registry: SourcePolicyRegistry
) -> dict[str, object]:
    return {
        "mode": "validation",
        **_safe_result(_inspect(registry, args.source_id, args.url, args.cnpj)),
    }


def _validate_file_command(
    args: argparse.Namespace, registry: SourcePolicyRegistry
) -> dict[str, object]:
    records = read_candidate_csv(args.file)
    sources: set[str] = set()
    for record in records:
        registry.guarded(
            record.source_id,
            ("website",),
            PolicyAction.COLETAR,
            lambda: None,
        )
        plan_egress(record.url)
        sources.add(record.source_id)
    return {
        "mode": "validation",
        "rows": len(records),
        "sources": sorted(sources),
        "writes": 0,
    }


def _propose_command(args: argparse.Namespace, registry: SourcePolicyRegistry) -> dict[str, object]:
    result = _inspect(registry, args.source_id, args.url, args.cnpj)
    proposed = SiteWorkflow.propose(
        args.lead_id,
        args.cnpj,
        args.source_id,
        plan_egress(args.url),
    )
    inspected = SiteWorkflow.inspect(
        proposed,
        result.final_target,
        result.assessment,
        redirect_count=len(result.redirect_chain),
    )
    output = {
        "lead_id": inspected.lead_id,
        "mode": "apply" if args.apply else "dry-run",
        "state": inspected.state.value,
        "version": inspected.version,
        "writes": 1 if args.apply else 0,
        **_safe_result(result),
    }
    if not args.apply:
        return output
    key, token = _credentials()
    saved = registry.guarded(
        args.source_id,
        PERSIST_FIELDS,
        PolicyAction.PERSISTIR,
        lambda: SiteDataApiRepository(key, token).save(
            inspected, expected_state=None, expected_version=0
        ),
    )
    output.update({"state": saved.state.value, "version": saved.version})
    return output


def _review_command(args: argparse.Namespace, registry: SourcePolicyRegistry) -> dict[str, object]:
    if not args.apply:
        return {"lead_id": args.lead_id, "mode": "dry-run", "writes": 0}
    key, token = _credentials()
    repository = SiteDataApiRepository(key, token)
    current = repository.get(args.lead_id)
    if current is None:
        raise SiteDataApiError("Candidato de site não localizado.")
    reviewed = SiteWorkflow.review(
        current,
        expected_version=args.expected_version,
        reviewer=args.reviewer,
        approve=args.decision == "approve",
        now=datetime.now(UTC),
    )
    fields = (
        (*PERSIST_FIELDS, "website") if reviewed.state == SiteState.CONFIRMED else PERSIST_FIELDS
    )
    saved = registry.guarded(
        current.source_id,
        fields,
        PolicyAction.PERSISTIR,
        lambda: repository.save(
            reviewed,
            expected_state=current.state,
            expected_version=args.expected_version,
        ),
    )
    return {
        "lead_id": saved.lead_id,
        "mode": "apply",
        "state": saved.state.value,
        "version": saved.version,
        "website_confirmed": saved.state.value == "confirmed",
        "writes": 1,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        registry = _registry()
        if args.command == "validar":
            result = _validate_command(args, registry)
        elif args.command == "validar-arquivo":
            result = _validate_file_command(args, registry)
        elif args.command == "propor":
            result = _propose_command(args, registry)
        else:
            result = _review_command(args, registry)
    except (
        CatalogConfigurationError,
        CandidateFileError,
        PolicyViolationError,
        ReviewConflictError,
        SiteDataApiError,
        SiteInspectionError,
        UrlSecurityError,
        ValueError,
    ) as exc:
        print(f"Operação M07 bloqueada: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
