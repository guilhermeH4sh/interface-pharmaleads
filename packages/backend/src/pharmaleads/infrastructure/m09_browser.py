"""Coleta M09 com Playwright: contexto descartável e egress validado por requisição."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from pharmaleads.domain.crawling.browser import BrowserEgressPlan, BrowserLimits
from pharmaleads.domain.crawling.extract import ExtractionResult, extract_contacts
from pharmaleads.domain.sites.security import Resolver, UrlSecurityError, system_resolver


class BrowserCollectionError(RuntimeError):
    """Falha sanitizada de uma coleta de browser."""


DEFAULT_LIMITS = BrowserLimits()


class RouteLike(Protocol):
    request: Any

    async def abort(self) -> None: ...

    async def continue_(self) -> None: ...


class PageLike(Protocol):
    async def goto(self, url: str, *, wait_until: str, timeout: float) -> Any: ...
    async def content(self) -> str: ...
    async def close(self) -> None: ...

    def on(self, event: str, handler: Callable[[Any], Any]) -> None: ...


class ContextLike(Protocol):
    async def route(
        self, pattern: str, handler: Callable[[RouteLike], Awaitable[None]]
    ) -> None: ...
    async def new_page(self) -> PageLike: ...
    async def close(self) -> None: ...


@dataclass(frozen=True)
class BrowserResult:
    extraction: ExtractionResult
    requests_allowed: int
    requests_blocked: int
    html_bytes: int


async def collect_with_playwright(
    *,
    egress: BrowserEgressPlan,
    lead_id: int,
    source_url: str,
    observed_at: datetime,
    resolver: Resolver = system_resolver,
    limits: BrowserLimits = DEFAULT_LIMITS,
) -> BrowserResult:
    """Abre Chromium só para a chamada M09 explicitamente solicitada.

    O pacote Python não baixa binário: o ambiente operacional instala Chromium antes
    da prova controlada. Contexto não persistente impede reutilização de cookies.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover - guarda a mensagem operacional
        raise BrowserCollectionError("Playwright Python não está instalado.") from exc
    playwright = await async_playwright().start()
    browser: Any | None = None
    try:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(service_workers="block")
        context.set_default_timeout(limits.navigation_timeout_seconds * 1000)
        return await collect_rendered_contacts(
            context,  # type: ignore[arg-type]  # protocolo reduzido para testes sem Chromium
            egress=egress,
            resolver=resolver,
            limits=limits,
            lead_id=lead_id,
            source_url=source_url,
            observed_at=observed_at,
        )
    except BrowserCollectionError:
        raise
    except Exception as exc:
        raise BrowserCollectionError("M09 não conseguiu iniciar ou controlar o navegador.") from exc
    finally:
        if browser is not None:
            await browser.close()
        await playwright.stop()


async def collect_rendered_contacts(
    context: ContextLike,
    *,
    egress: BrowserEgressPlan,
    resolver: Resolver = system_resolver,
    limits: BrowserLimits = DEFAULT_LIMITS,
    lead_id: int,
    source_url: str,
    observed_at: datetime,
) -> BrowserResult:
    """Navega uma só página; não segue popup nem aceita rede fora do domínio confirmado."""
    allowed = 0
    blocked = 0

    async def guard(route: RouteLike) -> None:
        nonlocal allowed, blocked
        if allowed + blocked >= limits.max_requests:
            blocked += 1
            await route.abort()
            return
        try:
            egress.allow(str(route.request.url), resolver)
        except (UrlSecurityError, ValueError):
            blocked += 1
            await route.abort()
            return
        allowed += 1
        await route.continue_()

    page: PageLike | None = None
    try:
        await context.route("**/*", guard)
        page = await context.new_page()
        # `close()` é coroutine na API assíncrona; agendá-la evita popup órfão.
        page.on("popup", lambda popup: asyncio.create_task(popup.close()))
        try:
            async with asyncio.timeout(limits.navigation_timeout_seconds):
                await page.goto(
                    source_url,
                    wait_until="domcontentloaded",
                    timeout=limits.navigation_timeout_seconds * 1000,
                )
                html = await page.content()
        except TimeoutError as exc:
            raise BrowserCollectionError("M09 excedeu o tempo máximo de navegação.") from exc
        encoded = html.encode("utf-8", errors="replace")
        if len(encoded) > limits.max_html_bytes:
            raise BrowserCollectionError("M09 excedeu o limite de HTML renderizado.")
        extraction = extract_contacts(
            html,
            lead_id=lead_id,
            source_id="confirmed_site_browser",
            source_url=source_url,
            observed_at=observed_at,
        )
        return BrowserResult(extraction, allowed, blocked, len(encoded))
    finally:
        if page is not None:
            await page.close()
        await context.close()
