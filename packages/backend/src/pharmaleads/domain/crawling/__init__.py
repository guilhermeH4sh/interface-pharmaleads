"""Domínio M08: observações candidatas extraídas de sites confirmados."""

from pharmaleads.domain.crawling.extract import ExtractionResult, extract_contacts
from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate

__all__ = ["ContactKind", "ExtractionResult", "ObservationCandidate", "extract_contacts"]
