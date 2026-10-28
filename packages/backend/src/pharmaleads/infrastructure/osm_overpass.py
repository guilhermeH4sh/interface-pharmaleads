"""Descoberta OSM M20 limitada, sem persistência de dados brutos."""

from __future__ import annotations

import json
import re
import ssl
import unicodedata
from dataclasses import dataclass
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode, urlsplit

HOST = "overpass-api.de"
PATH = "/api/interpreter"
MAX_RESPONSE_BYTES = 1_048_576
SOURCE_ID = "osm_site_candidate"
LEGAL_SUFFIXES = {"LTDA", "ME", "EPP", "SA", "S", "A", "EIRELI"}
SP_BBOX = "-25.36,-53.11,-19.78,-44.16"


class OsmDiscoveryError(RuntimeError):
    """Falha sanitizada da descoberta OSM."""


@dataclass(frozen=True)
class OsmLead:
    lead_id: int
    cnpj: str
    name: str
    uf: str
    city: str


def normalized_name(value: str) -> str:
    folded = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    return " ".join(re.findall(r"[A-Z0-9]+", folded.upper()))


def name_tokens(value: str) -> tuple[str, ...]:
    return tuple(token for token in normalized_name(value).split() if token not in LEGAL_SUFFIXES)


def name_matches(lead_name: str, osm_name: str) -> bool:
    expected = set(name_tokens(lead_name))
    observed = set(name_tokens(osm_name))
    if not expected or not observed:
        return False
    return len(expected & observed) / len(expected) >= 0.8


def _regex(value: str) -> str:
    tokens = name_tokens(value)
    if not tokens or len(" ".join(tokens)) < 4 or len(tokens) > 8:
        raise ValueError("Nome do estabelecimento inválido para descoberta.")
    return r".*".join(re.escape(token) for token in tokens)


def query_for(lead: OsmLead) -> str:
    if lead.uf != "SP":
        raise ValueError("Piloto OSM limitado à UF SP.")
    pattern = _regex(lead.name)
    return (
        "[out:json][timeout:15];"
        f'nwr["name"~"^{pattern}$",i]["website"]({SP_BBOX});'
        "out tags center 10;"
    )


def _website(tags: dict[str, object]) -> str | None:
    value = tags.get("website") or tags.get("contact:website")
    if not isinstance(value, str) or len(value) > 2_048:
        return None
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        return None
    return value.strip()


def candidates(lead: OsmLead, document: object) -> tuple[dict[str, object], ...]:
    if not isinstance(document, dict) or not isinstance(document.get("elements"), list):
        raise OsmDiscoveryError("Resposta OSM inválida.")
    result: list[dict[str, object]] = []
    for element in document["elements"]:
        if not isinstance(element, dict) or not isinstance(element.get("tags"), dict):
            continue
        tags = element["tags"]
        name = tags.get("name")
        url = _website(tags)
        if not isinstance(name, str) or url is None or not name_matches(lead.name, name):
            continue
        identifier = element.get("id")
        kind = element.get("type")
        if not isinstance(identifier, int) or not isinstance(kind, str):
            continue
        result.append(
            {
                "cnpj": lead.cnpj,
                "lead_id": lead.lead_id,
                "osm_element": f"{kind}/{identifier}",
                "osm_name": name,
                "source_id": SOURCE_ID,
                "url": url,
            }
        )
    return tuple(sorted(result, key=lambda item: str(item["url"])))


class OverpassClient:
    def discover(self, lead: OsmLead) -> tuple[dict[str, object], ...]:
        body = urlencode({"data": query_for(lead)}).encode()
        connection = HTTPSConnection(HOST, timeout=20, context=ssl.create_default_context())
        try:
            connection.request(
                "POST",
                PATH,
                body,
                {
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "PharmaLeads-M20-OSM-pilot/1.0",
                },
            )
            response = connection.getresponse()
            raw = response.read(MAX_RESPONSE_BYTES + 1)
        except OSError as exc:
            raise OsmDiscoveryError("Consulta OSM indisponível ou excedeu o tempo.") from exc
        finally:
            connection.close()
        if len(raw) > MAX_RESPONSE_BYTES:
            raise OsmDiscoveryError("Resposta OSM acima do limite.")
        if response.status != 200:
            raise OsmDiscoveryError(f"Consulta OSM recusada (HTTP {response.status}).")
        try:
            document: Any = json.loads(raw)
        except (UnicodeError, ValueError) as exc:
            raise OsmDiscoveryError("Resposta OSM inválida.") from exc
        return candidates(lead, document)
