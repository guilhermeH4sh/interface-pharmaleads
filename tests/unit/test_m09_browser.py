"""M09: limites e isolamento de rede testados sem baixar um browser."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from pharmaleads.domain.crawling.browser import BrowserLimits, browser_egress
from pharmaleads.domain.sites.security import UrlSecurityError
from pharmaleads.infrastructure.m09_browser import BrowserCollectionError, collect_rendered_contacts

PUBLIC = "93.184.216.34"


def run(coro):
    # O loop selector evita o socketpair do Proactor em runners Windows isolados.
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        return runner.run(coro)


def resolver(_host: str, _port: int) -> tuple[str, ...]:
    return (PUBLIC,)


@dataclass
class FakeRoute:
    url: str
    aborted: bool = False
    continued: bool = False

    @property
    def request(self):
        return SimpleNamespace(url=self.url)

    async def abort(self) -> None:
        self.aborted = True

    async def continue_(self) -> None:
        self.continued = True


class FakePage:
    def __init__(self, context: FakeContext, html: str, timeout: bool = False) -> None:
        self.context, self.html, self.timeout, self.closed = context, html, timeout, False

    async def goto(self, url: str, **_kwargs: object) -> None:
        assert self.context.handler is not None
        await self.context.handler(FakeRoute(url))
        await self.context.handler(FakeRoute("https://tracker.invalid/script.js"))
        if self.timeout:
            await asyncio.Future()

    async def content(self) -> str:
        return self.html

    async def close(self) -> None:
        self.closed = True

    def on(self, _event: str, _handler) -> None:
        return None


class FakeContext:
    def __init__(self, html: str, timeout: bool = False) -> None:
        self.html, self.timeout, self.handler, self.closed = html, timeout, None, False
        self.page: FakePage | None = None

    async def route(self, _pattern: str, handler) -> None:
        self.handler = handler

    async def new_page(self) -> FakePage:
        self.page = FakePage(self, self.html, self.timeout)
        return self.page

    async def close(self) -> None:
        self.closed = True


def test_browser_egress_blocks_other_host_and_dns_change() -> None:
    plan = browser_egress("https://example.com/", resolver)
    assert plan.allow("https://example.com/contact", resolver).host == "example.com"
    with pytest.raises(UrlSecurityError):
        plan.allow("https://elsewhere.example/", resolver)
    with pytest.raises(UrlSecurityError):
        plan.allow("https://example.com/", lambda _h, _p: ("1.1.1.1",))


def test_rendered_page_extracts_contacts_and_closes_context() -> None:
    context = FakeContext('<a href="mailto:js@example.com">e</a><a href="tel:+551133334444">t</a>')
    result = run(
        collect_rendered_contacts(
            context,
            egress=browser_egress("https://example.com/", resolver),
            resolver=resolver,
            lead_id=1,
            source_url="https://example.com/",
            observed_at=datetime(2026, 10, 27, tzinfo=UTC),
        )
    )
    assert [item.raw_value for item in result.extraction.observations] == [
        "js@example.com",
        "+551133334444",
    ]
    assert (result.requests_allowed, result.requests_blocked) == (1, 1)
    assert context.closed and context.page is not None and context.page.closed


def test_timeout_cancels_and_closes_context() -> None:
    context = FakeContext("", timeout=True)
    with pytest.raises(BrowserCollectionError, match="tempo máximo"):
        run(
            collect_rendered_contacts(
                context,
                egress=browser_egress("https://example.com/", resolver),
                resolver=resolver,
                limits=BrowserLimits(navigation_timeout_seconds=0.1),
                lead_id=1,
                source_url="https://example.com/",
                observed_at=datetime(2026, 10, 27, tzinfo=UTC),
            )
        )
    assert context.closed and context.page is not None and context.page.closed
