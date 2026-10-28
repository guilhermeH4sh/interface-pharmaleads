"""Contrato M09: navegador opcional, limitado e sem fallback implícito."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

from pharmaleads.domain.sites.security import (
    EgressTarget,
    Resolver,
    UrlSecurityError,
    plan_egress,
    system_resolver,
)

SOURCE_ID = "confirmed_site_browser"
JOB_KIND = "crawl_browser"
REQUIRED_REASON = "dynamic_after_http"


@dataclass(frozen=True)
class BrowserLimits:
    max_contexts: int = 1
    max_pages: int = 1
    navigation_timeout_seconds: float = 10.0
    max_requests: int = 30
    max_html_bytes: int = 512 * 1024

    def __post_init__(self) -> None:
        if self.max_contexts != 1 or self.max_pages != 1:
            raise ValueError("M09 permite somente um contexto e uma página por execução.")
        if not 0.1 <= self.navigation_timeout_seconds <= 30:
            raise ValueError("Timeout do navegador fora do limite.")
        if not 1 <= self.max_requests <= 100 or not 1 <= self.max_html_bytes <= 512 * 1024:
            raise ValueError("Limite do navegador inválido.")


@dataclass(frozen=True)
class BrowserEgressPlan:
    target: EgressTarget

    @property
    def host(self) -> str:
        return self.target.host

    def allow(self, raw_url: str, resolver: Resolver) -> EgressTarget:
        candidate = plan_egress(raw_url, resolver)
        if candidate.host != self.target.host:
            raise UrlSecurityError("M09 bloqueou subrequisição fora do domínio confirmado.")
        if self.target.scheme == "https" and candidate.scheme != "https":
            raise UrlSecurityError("M09 bloqueou downgrade HTTPS.")
        if not set(candidate.addresses).issubset(self.target.addresses):
            raise UrlSecurityError("M09 bloqueou alteração de DNS durante a navegação.")
        return candidate


def browser_egress(url: str, resolver: Resolver = system_resolver) -> BrowserEgressPlan:
    """Autoriza explicitamente o domínio confirmado antes de iniciar o browser."""
    return BrowserEgressPlan(plan_egress(url, resolver))


def same_confirmed_origin(url: str, plan: BrowserEgressPlan) -> bool:
    parsed = urlsplit(url)
    return (
        parsed.scheme in {"http", "https"}
        and (parsed.hostname or "").rstrip(".").lower() == plan.host
    )
