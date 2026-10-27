"""Estados imutáveis do fluxo candidato → revisão → confirmação."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from pharmaleads.domain.sites.linkage import LinkKind


class SiteState(StrEnum):
    CANDIDATE = "candidate"
    REVIEW_REQUIRED = "review_required"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


@dataclass(frozen=True)
class SiteCandidate:
    lead_id: int
    cnpj: str
    source_id: str
    candidate_url: str
    final_url: str | None = None
    state: SiteState = SiteState.CANDIDATE
    link_kind: LinkKind | None = None
    evidence: dict[str, Any] = field(default_factory=dict)
    version: int = 0
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.lead_id < 1 or self.version < 0:
            raise ValueError("Estado de site inválido.")
        if not self.source_id.strip() or len(self.source_id) > 64:
            raise ValueError("Fonte do candidato inválida.")
        if self.reviewed_at is not None and (
            self.reviewed_at.tzinfo is None or self.reviewed_at.utcoffset() is None
        ):
            raise ValueError("Revisão deve usar timezone.")
