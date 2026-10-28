"""Normalização e score M10, sem escrita comercial ou rede."""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate

SCORE_VERSION = "m10-v1"
SHARED_THRESHOLD = 3


def normalize(kind: ContactKind, value: str) -> str:
    if kind is ContactKind.EMAIL:
        local, separator, domain = value.strip().partition("@")
        if not separator or not local or not domain:
            raise ValueError("E-mail inválido.")
        return f"{local}@{domain.casefold()}"
    digits = "".join(re.findall(r"\d", value))
    if not 8 <= len(digits) <= 15:
        raise ValueError("Telefone inválido.")
    return digits


def normalize_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("URL de evidência inválida.")
    return urlunsplit((parsed.scheme, parsed.netloc.casefold(), parsed.path or "/", "", ""))


@dataclass(frozen=True)
class ConsolidatedContact:
    kind: ContactKind
    value: str
    lead_ids: tuple[int, ...]
    evidence_hashes: tuple[str, ...]
    source_ids: tuple[str, ...]
    shared: bool
    score: int
    score_version: str = SCORE_VERSION


def consolidate(observations: Iterable[ObservationCandidate]) -> tuple[ConsolidatedContact, ...]:
    grouped: dict[tuple[ContactKind, str], list[ObservationCandidate]] = defaultdict(list)
    for observation in observations:
        grouped[(observation.kind, normalize(observation.kind, observation.raw_value))].append(
            observation
        )
    result: list[ConsolidatedContact] = []
    for (kind, value), candidates in grouped.items():
        evidence = tuple(sorted({candidate.evidence_hash for candidate in candidates}))
        sources = tuple(sorted({candidate.source_id for candidate in candidates}))
        leads = tuple(sorted({candidate.lead_id for candidate in candidates}))
        shared = len(leads) >= SHARED_THRESHOLD
        # Evidência independente agrega confiança; contato compartilhado não recebe bônus.
        score = min(100, 40 + min(30, 10 * len(evidence)) + min(30, 10 * len(sources)))
        result.append(ConsolidatedContact(kind, value, leads, evidence, sources, shared, score))
    return tuple(sorted(result, key=lambda item: (item.kind.value, item.value)))


def checkpoint_records(
    observations: Iterable[ObservationCandidate],
) -> tuple[dict[str, object], ...]:
    """Formato persistível sem reutilizar campos comerciais do lead."""
    return tuple(
        {
            "kind": contact.kind.value,
            "value": contact.value,
            "shared": contact.shared,
            "score": contact.score,
            "score_version": contact.score_version,
            "sources": list(contact.source_ids),
            "evidence_hashes": list(contact.evidence_hashes),
        }
        for contact in consolidate(observations)
    )


def evidence_records(
    observations: Iterable[ObservationCandidate],
) -> tuple[dict[str, str], ...]:
    """Evidência mínima auditável, sem repetir o valor bruto do contato."""
    records = {
        (
            observation.evidence_hash,
            observation.source_id,
            normalize_url(observation.source_url),
            observation.observed_at.astimezone().isoformat(),
            observation.extractor_version,
        )
        for observation in observations
    }
    return tuple(
        {
            "evidence_hash": evidence_hash,
            "source_id": source_id,
            "source_url": source_url,
            "observed_at": observed_at,
            "extractor_version": extractor_version,
        }
        for evidence_hash, source_id, source_url, observed_at, extractor_version in sorted(records)
    )
