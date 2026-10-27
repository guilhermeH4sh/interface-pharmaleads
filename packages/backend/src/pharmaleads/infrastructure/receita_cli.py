"""CLI M05: validação, stage, promoção e relatório G1 da Receita Federal."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

from pharmaleads.domain.receita.official import collect_official
from pharmaleads.domain.receita.pipeline import (
    COLLECTED_FIELDS,
    SOURCE_ID,
    ReceitaImportError,
    build_pilot_stage,
    build_stage,
    g1_report,
    iter_promotion_batches,
    validate_layout,
)
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.data_api import KEY_ENV
from pharmaleads.infrastructure.data_api_writer import (
    WRITE_APPROVAL_ENV,
    ImportErrorSafe,
    PharmaleadsWriter,
)

ACCESS_TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use competência no formato AAAA-MM-DD.") from exc


def _inputs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--input", action="append", required=True, type=Path)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Pipeline M05 da Receita Federal.")
    commands = root.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validar", help="Valida ZIPs e layout sem criar stage")
    _inputs(validate)

    for name in ("dry-run", "importar"):
        command = commands.add_parser(name)
        _inputs(command)
        command.add_argument("--output", required=True, type=Path)
        command.add_argument("--competencia", required=True, type=_date)

    promote = commands.add_parser("promover", help="Upsert cadastral em public.pharmaleads")
    promote.add_argument("--stage", required=True, type=Path)
    promote.add_argument("--batch-size", type=int, default=100)
    promote.add_argument("--apply", action="store_true")

    report = commands.add_parser("relatorio", help="Gera o relatório G1 do stage")
    report.add_argument("--stage", required=True, type=Path)
    report.add_argument("--output", type=Path)

    official = commands.add_parser(
        "coletar-oficial", help="Baixa e filtra a competência oficial com baixo uso de disco"
    )
    official.add_argument("--work", required=True, type=Path)
    official.add_argument("--output", required=True, type=Path)
    official.add_argument("--competencia", required=True, type=_date)

    sample = commands.add_parser("amostrar", help="Cria piloto estratificado de um stage")
    sample.add_argument("--stage", required=True, type=Path)
    sample.add_argument("--output", required=True, type=Path)
    sample.add_argument("--size", type=int, default=100)
    return root


def _promote(args: argparse.Namespace) -> dict[str, object]:
    batches = iter_promotion_batches(args.stage, args.batch_size)
    if not args.apply:
        return {
            "table": "public.pharmaleads",
            "source": SOURCE_ID,
            "rows_validated": sum(len(batch) for batch in batches),
            "writes_performed": 0,
        }
    if os.environ.get(WRITE_APPROVAL_ENV) != "public.pharmaleads":
        raise ReceitaImportError("Liberação operacional de escrita ausente.")
    if not sys.stdin.isatty():
        raise ReceitaImportError("Confirmação interativa obrigatória.")
    if input("Digite PROMOVER public.pharmaleads para gravar: ").strip() != (
        "PROMOVER public.pharmaleads"
    ):
        raise ReceitaImportError("Promoção cancelada.")
    access_token = os.environ.get(ACCESS_TOKEN_ENV)
    if not access_token:
        raise ReceitaImportError("JWT de usuário autenticado ausente.")
    writer = PharmaleadsWriter(
        os.environ.get(KEY_ENV, ""),
        source_id=SOURCE_ID,
        access_token=access_token,
    )
    written = verified = 0
    for batch in batches:
        written += writer.upsert_cadastral(batch)
        verified += writer.verify_cnpjs(batch)
    return {
        "table": "public.pharmaleads",
        "source": SOURCE_ID,
        "rows_written": written,
        "rows_verified": verified,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        registry = SourcePolicyRegistry()
        if args.command == "validar":
            result: object = registry.guarded(
                SOURCE_ID,
                COLLECTED_FIELDS,
                PolicyAction.COLETAR,
                lambda: validate_layout(args.input),
            )
        elif args.command in {"dry-run", "importar"}:
            result = registry.guarded(
                SOURCE_ID,
                COLLECTED_FIELDS,
                PolicyAction.COLETAR,
                lambda: build_stage(
                    args.input,
                    args.output,
                    args.competencia,
                    dry_run=args.command == "dry-run",
                ),
            )
            result = result.__dict__
        elif args.command == "promover":
            result = _promote(args)
        elif args.command == "coletar-oficial":
            result = registry.guarded(
                SOURCE_ID,
                COLLECTED_FIELDS,
                PolicyAction.COLETAR,
                lambda: collect_official(
                    args.work,
                    args.output,
                    args.competencia,
                    progress=lambda message: print(message, file=sys.stderr, flush=True),
                ),
            )
            result = result.__dict__
        elif args.command == "amostrar":
            result = build_pilot_stage(args.stage, args.output, args.size)
        else:
            result = g1_report(args.stage)
            if args.output is not None:
                args.output.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (ReceitaImportError, ImportErrorSafe, ValueError) as exc:
        print(f"Operação M05 bloqueada: {exc}", file=sys.stderr)
        return 1
    except OSError:
        print("Operação M05 bloqueada: falha local ou de rede.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
