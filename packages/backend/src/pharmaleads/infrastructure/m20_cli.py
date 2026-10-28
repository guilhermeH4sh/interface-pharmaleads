"""Piloto M20: descobrir candidatos OSM para até 20 leads de São Paulo."""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import tempfile
import time
from http.client import HTTPSConnection
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.data_api import HOST, validate_publishable_key
from pharmaleads.infrastructure.m10_cli import KEY_ENV, TOKEN_ENV
from pharmaleads.infrastructure.osm_overpass import (
    SOURCE_ID,
    OsmDiscoveryError,
    OsmLead,
    OverpassClient,
)
from pharmaleads.infrastructure.osm_pbf import OsmPbfError, discover_from_pbf, download_sudeste_pbf

TABLE_PATH = "/rest/v1/pharmaleads"
SELECT_FIELDS = "id,cnpj,nome,razao_social,uf,cidade"
MAX_LEADS = 20


class M20DataApiError(RuntimeError):
    """Falha sanitizada de leitura do piloto M20."""


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Descobre candidatos OSM para o piloto SP.")
    root.add_argument("--lead-id", action="append", type=int, required=True)
    root.add_argument("--apply", action="store_true")
    source = root.add_mutually_exclusive_group()
    source.add_argument("--pbf-file", type=Path)
    source.add_argument("--download-pbf", action="store_true")
    return root


def _request(key: str, token: str, lead_ids: list[int]) -> list[dict[str, Any]]:
    identifiers = ",".join(str(item) for item in sorted(set(lead_ids)))
    query = {"select": SELECT_FIELDS, "id": f"in.({identifiers})", "limit": str(MAX_LEADS)}
    connection = HTTPSConnection(HOST, timeout=10, context=ssl.create_default_context())
    try:
        connection.request(
            "GET",
            f"{TABLE_PATH}?{urlencode(query)}",
            headers={
                "Accept": "application/json",
                "Accept-Profile": "public",
                "apikey": key,
                "Authorization": f"Bearer {token}",
            },
        )
        response = connection.getresponse()
        raw = response.read(262_145)
    finally:
        connection.close()
    if len(raw) > 262_144:
        raise M20DataApiError("Leitura do piloto OSM excedeu o limite.")
    if response.status not in {200, 206}:
        raise M20DataApiError(f"Leitura do piloto OSM recusada (HTTP {response.status}).")
    try:
        rows = json.loads(raw)
    except (UnicodeError, ValueError) as exc:
        raise M20DataApiError("Leitura do piloto OSM inválida.") from exc
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise M20DataApiError("Leitura do piloto OSM inválida.")
    return rows


def _lead(row: dict[str, Any]) -> OsmLead:
    try:
        name = str(row.get("nome") or row["razao_social"])
        return OsmLead(int(row["id"]), str(row["cnpj"]), name, str(row["uf"]), str(row["cidade"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise M20DataApiError("Lead do piloto OSM inválido.") from exc


def _discover_from_local_extract(
    leads: tuple[OsmLead, ...], pbf_file: Path
) -> tuple[dict[str, object], ...]:
    return discover_from_pbf(pbf_file, leads)


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    lead_ids = sorted(set(args.lead_id))
    if not lead_ids or len(lead_ids) > MAX_LEADS or min(lead_ids) < 1:
        print("M20 bloqueado: informe de 1 a 20 leads válidos.", file=sys.stderr)
        return 2
    if not args.apply:
        print(json.dumps({"lead_ids": lead_ids, "mode": "dry-run", "writes": 0}))
        return 0
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("M20 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        validate_publishable_key(key)
        registry = SourcePolicyRegistry()
        registry.snapshot().check_or_raise(SOURCE_ID, "website", PolicyAction.COLETAR)
        leads = tuple(_lead(row) for row in _request(key, token, lead_ids))
        if len(leads) != len(lead_ids) or any(lead.uf != "SP" for lead in leads):
            raise M20DataApiError("Piloto OSM requer leads existentes da UF SP.")
        backend = "overpass"
        failed_leads: list[int] = []
        if args.download_pbf:
            backend = "geofabrik_pbf_ephemeral"
            with tempfile.TemporaryDirectory(prefix="pharmaleads-m20-") as temporary:
                extract = download_sudeste_pbf(Path(temporary) / "sudeste-latest.osm.pbf")
                discovered = list(_discover_from_local_extract(leads, extract))
        elif args.pbf_file is not None:
            backend = "geofabrik_pbf_local"
            discovered = list(_discover_from_local_extract(leads, args.pbf_file))
        else:
            client = OverpassClient()
            discovered = []
            for index, lead in enumerate(leads):
                try:
                    discovered.extend(client.discover(lead))
                except OsmDiscoveryError:
                    failed_leads.append(lead.lead_id)
                if index + 1 < len(leads):
                    time.sleep(2)
        print(
            json.dumps(
                {
                    "attribution": "© OpenStreetMap contributors, ODbL",
                    "backend": backend,
                    "candidates": discovered,
                    "failed_lead_ids": failed_leads,
                    "leads_queried": len(leads),
                    "source_id": SOURCE_ID,
                    "writes": 0,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except (M20DataApiError, OsmDiscoveryError, OsmPbfError, ValueError) as exc:
        print(f"M20 bloqueado: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
