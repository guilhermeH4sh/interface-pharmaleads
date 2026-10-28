"""Normalização e score M10, sem escrita comercial ou rede."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate

SCORE_VERSION = "m10-v1"
SHARED_THRESHOLD = 3
REVIEW_STATES = {"pending", "approved", "rejected"}


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


def contact_id(kind: ContactKind, value: str) -> str:
    """Identificador estável para revisão sem expor outro dado do lead."""
    normalized = normalize(kind, value)
    return hashlib.sha256(f"{kind.value}\x00{normalized}".encode()).hexdigest()


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
            "id": contact_id(contact.kind, contact.value),
            "kind": contact.kind.value,
            "value": contact.value,
            "shared": contact.shared,
            "score": contact.score,
            "score_version": contact.score_version,
            "sources": list(contact.source_ids),
            "evidence_hashes": list(contact.evidence_hashes),
            "review_state": "pending",
        }
        for contact in consolidate(observations)
    )


def evidence_records(
    observations: Iterable[ObservationCandidate],
) -> tuple[dict[str, object], ...]:
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
            "content_state": "minimal_only",
        }
        for evidence_hash, source_id, source_url, observed_at, extractor_version in sorted(records)
    )


def preserve_reviews(
    records: Iterable[dict[str, object]],
    existing: Iterable[dict[str, object]],
) -> tuple[dict[str, object], ...]:
    """Mantém decisão humana apenas para o mesmo contato normalizado."""
    reviewed = {
        item.get("id"): item
        for item in existing
        if isinstance(item.get("id"), str) and item.get("review_state") in REVIEW_STATES
    }
    result: list[dict[str, object]] = []
    for record in records:
        updated = dict(record)
        prior = reviewed.get(updated["id"])
        if isinstance(prior, dict):
            for name in ("review_state", "reviewed_by", "reviewed_at"):
                if name in prior:
                    updated[name] = prior[name]
        result.append(updated)
    return tuple(result)


def review_records(
    records: Iterable[dict[str, object]],
    contact_ids: set[str],
    decision: str,
    reviewer: str,
    reviewed_at: str,
) -> tuple[dict[str, object], ...]:
    if decision not in REVIEW_STATES - {"pending"}:
        raise ValueError("Decisão de revisão inválida.")
    if not reviewer or not contact_ids:
        raise ValueError("Revisão de contato inválida.")
    updated: list[dict[str, object]] = []
    found: set[str] = set()
    for record in records:
        item = dict(record)
        identifier = item.get("id")
        if isinstance(identifier, str) and identifier in contact_ids:
            item.update(
                {
                    "review_state": decision,
                    "reviewed_by": reviewer,
                    "reviewed_at": reviewed_at,
                }
            )
            found.add(identifier)
        updated.append(item)
    if found != contact_ids:
        raise ValueError("Contato da revisão não localizado.")
    return tuple(updated)
