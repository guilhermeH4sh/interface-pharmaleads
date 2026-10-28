"""Leitura local e efêmera do extrato OSM Sudeste para o piloto M20."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from pharmaleads.infrastructure.osm_overpass import (
    GEFABRIK_SUDESTE_URL,
    OsmLead,
    candidate_from_tags,
    name_tokens,
)

MAX_PBF_BYTES = 900 * 1024 * 1024


class OsmPbfError(RuntimeError):
    """Falha sanitizada na leitura do extrato OSM."""


def download_sudeste_pbf(destination: Path) -> Path:
    """Baixa o único extrato permitido, com teto antes de ocupar o disco."""
    request = Request(GEFABRIK_SUDESTE_URL, headers={"User-Agent": "PharmaLeads-M20/1.0"})
    try:
        with urlopen(request, timeout=60) as response:  # noqa: S310 - URL constante oficial
            length = response.headers.get("Content-Length")
            if length is not None and (not length.isdecimal() or int(length) > MAX_PBF_BYTES):
                raise OsmPbfError("Extrato OSM acima do limite local.")
            received = 0
            with destination.open("xb") as output:
                while chunk := response.read(1_048_576):
                    received += len(chunk)
                    if received > MAX_PBF_BYTES:
                        raise OsmPbfError("Extrato OSM acima do limite local.")
                    output.write(chunk)
    except (OSError, TimeoutError) as exc:
        destination.unlink(missing_ok=True)
        raise OsmPbfError("Download do extrato OSM indisponível.") from exc
    if not destination.is_file() or destination.stat().st_size == 0:
        destination.unlink(missing_ok=True)
        raise OsmPbfError("Download do extrato OSM inválido.")
    return destination


def discover_from_pbf(path: Path, leads: Iterable[OsmLead]) -> tuple[dict[str, object], ...]:
    """Lê somente tags necessárias e devolve candidatos, sem persistir dados brutos."""
    if not path.is_file() or path.suffix != ".pbf":
        raise OsmPbfError("Extrato OSM PBF inválido.")
    try:
        import osmium
    except ImportError as exc:  # pragma: no cover - controlado pela dependência do pacote
        raise OsmPbfError("Dependência osmium indisponível.") from exc

    leads_by_first_token: dict[str, list[OsmLead]] = {}
    for lead in leads:
        tokens = name_tokens(lead.name)
        if tokens:
            leads_by_first_token.setdefault(tokens[0], []).append(lead)
    found: dict[tuple[int, str], dict[str, object]] = {}

    class Handler(osmium.SimpleHandler):
        def _collect(self, kind: str, item: Any) -> None:
            tags = dict(item.tags)
            name = tags.get("name")
            if not isinstance(name, str):
                return
            observed = name_tokens(name)
            if not observed:
                return
            for lead in leads_by_first_token.get(observed[0], []):
                candidate = candidate_from_tags(lead, element=f"{kind}/{item.id}", tags=tags)
                if candidate is not None:
                    found[(lead.lead_id, str(candidate["url"]))] = candidate

        def node(self, node: Any) -> None:
            self._collect("node", node)

        def way(self, way: Any) -> None:
            self._collect("way", way)

        def relation(self, relation: Any) -> None:
            self._collect("relation", relation)

    try:
        Handler().apply_file(str(path), locations=False)
    except (OSError, RuntimeError, ValueError) as exc:
        raise OsmPbfError("Não foi possível ler o extrato OSM.") from exc
    return tuple(
        sorted(found.values(), key=lambda item: (int(str(item["lead_id"])), str(item["url"])))
    )
