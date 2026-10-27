"""Evidência mínima e explicável de vínculo entre site, rede e filial."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

from pharmaleads.shared.identifiers import normalize_cnpj

MASKED_CNPJ = re.compile(
    r"(?<![A-Z0-9])[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}(?![A-Z0-9])",
    re.IGNORECASE,
)
PLAIN_CNPJ = re.compile(r"(?<![A-Z0-9])[A-Z0-9]{12}[0-9]{2}(?![A-Z0-9])", re.IGNORECASE)


class LinkKind(StrEnum):
    BRANCH_EXACT = "branch_exact"
    SAME_NETWORK = "same_network"
    OTHER_COMPANY = "other_company"
    UNCONFIRMED = "unconfirmed"


@dataclass(frozen=True)
class LinkAssessment:
    kind: LinkKind
    target_cnpj: str
    observed_cnpjs: tuple[str, ...]

    @property
    def strong(self) -> bool:
        return self.kind == LinkKind.BRANCH_EXACT


def extract_cnpjs(content: str) -> tuple[str, ...]:
    found: set[str] = set()
    upper = content.upper()
    for match in (*MASKED_CNPJ.findall(upper), *PLAIN_CNPJ.findall(upper)):
        try:
            found.add(normalize_cnpj(match))
        except ValueError:
            continue
    return tuple(sorted(found))


def assess_cnpj_link(target_cnpj: str, content: str) -> LinkAssessment:
    target = normalize_cnpj(target_cnpj)
    observed = extract_cnpjs(content)
    if target in observed:
        kind = LinkKind.BRANCH_EXACT
    elif any(value[:8] == target[:8] for value in observed):
        kind = LinkKind.SAME_NETWORK
    elif observed:
        kind = LinkKind.OTHER_COMPANY
    else:
        kind = LinkKind.UNCONFIRMED
    return LinkAssessment(kind=kind, target_cnpj=target, observed_cnpjs=observed)
