"""Contratos imutáveis das observações M08, ainda sem promoção a contato."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum


class ContactKind(StrEnum):
    EMAIL = "email"
    PHONE = "telefone"
    WHATSAPP = "whatsapp"


@dataclass(frozen=True)
class ObservationCandidate:
    lead_id: int
    source_id: str
    kind: ContactKind
    raw_value: str
    observed_at: datetime
    source_url: str
    extractor_version: str
    evidence_hash: str

    def __post_init__(self) -> None:
        if self.lead_id < 1:
            raise ValueError("Lead da observação inválido.")
        if not self.source_id.strip() or len(self.source_id) > 64:
            raise ValueError("Fonte da observação inválida.")
        if not self.raw_value or len(self.raw_value) > 2_048:
            raise ValueError("Valor observado inválido.")
        if self.observed_at.tzinfo is None or self.observed_at.utcoffset() is None:
            raise ValueError("Observação deve usar timezone.")
        if not self.source_url or len(self.source_url) > 2_048:
            raise ValueError("URL da observação inválida.")
        if not self.extractor_version or len(self.extractor_version) > 64:
            raise ValueError("Versão do extrator inválida.")
        if len(self.evidence_hash) != 64:
            raise ValueError("Hash da evidência inválido.")

    def checkpoint(self) -> dict[str, str | int]:
        return {
            "lead_id": self.lead_id,
            "source_id": self.source_id,
            "kind": self.kind.value,
            "raw_value": self.raw_value,
            "observed_at": self.observed_at.astimezone(UTC).isoformat(),
            "source_url": self.source_url,
            "extractor_version": self.extractor_version,
            "evidence_hash": self.evidence_hash,
        }

    @classmethod
    def from_checkpoint(cls, value: object) -> ObservationCandidate:
        if not isinstance(value, dict):
            raise ValueError("Observação de checkpoint inválida.")
        try:
            return cls(
                lead_id=int(value["lead_id"]),
                source_id=str(value["source_id"]),
                kind=ContactKind(str(value["kind"])),
                raw_value=str(value["raw_value"]),
                observed_at=datetime.fromisoformat(str(value["observed_at"])),
                source_url=str(value["source_url"]),
                extractor_version=str(value["extractor_version"]),
                evidence_hash=str(value["evidence_hash"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Observação de checkpoint inválida.") from exc
