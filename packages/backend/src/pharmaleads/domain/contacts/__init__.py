"""M10: consolidação determinística de observações de contato."""

from pharmaleads.domain.contacts.service import ConsolidatedContact, consolidate

__all__ = ["ConsolidatedContact", "consolidate"]
