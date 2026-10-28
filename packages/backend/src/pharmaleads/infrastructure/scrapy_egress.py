"""Download Scrapy com domínio confirmado, SSRF e conexão presa ao IP validado."""

from __future__ import annotations

from typing import Any

from scrapy import Request
from scrapy.crawler import Crawler
from scrapy.exceptions import IgnoreRequest
from scrapy.http import Headers, HtmlResponse, Response, TextResponse
from twisted.internet import threads
from twisted.internet.defer import Deferred

from pharmaleads.domain.sites.security import EgressTarget, Resolver, plan_egress, system_resolver
from pharmaleads.infrastructure.site_http import (
    MAX_BODY_BYTES,
    BoundedResponse,
    PinnedSiteTransport,
)

TARGET_META = "m08_egress_target"


class SafeEgressMiddleware:
    def __init__(
        self,
        resolver: Resolver = system_resolver,
        crawler: Crawler | None = None,
    ) -> None:
        self._resolver = resolver
        self._crawler = crawler

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> SafeEgressMiddleware:
        return cls(crawler=crawler)

    def process_request(self, request: Request) -> None:
        spider = self._crawler.spider if self._crawler is not None else None
        if spider is None:
            raise IgnoreRequest("M08 não localizou o spider para validar egress.")
        confirmed_host = getattr(spider, "confirmed_host", "")
        confirmed_scheme = getattr(spider, "confirmed_scheme", "")
        try:
            target = plan_egress(request.url, self._resolver)
        except ValueError as exc:
            raise IgnoreRequest("M08 bloqueou destino de rede.") from exc
        if not confirmed_host or target.host != confirmed_host:
            raise IgnoreRequest("M08 bloqueou domínio fora do site confirmado.")
        if confirmed_scheme == "https" and target.scheme != "https":
            raise IgnoreRequest("M08 bloqueou downgrade do site confirmado.")
        request.meta[TARGET_META] = target


class SafePinnedDownloadHandler:
    lazy = True

    def __init__(self, _settings: Any, _crawler: Crawler | None = None) -> None:
        self._transport = PinnedSiteTransport(
            timeout=10,
            user_agent="PharmaLeads-M08/1.0 (+contato institucional)",
        )

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> SafePinnedDownloadHandler:
        return cls(crawler.settings, crawler)

    @staticmethod
    def _response(request: Request, result: BoundedResponse) -> Response:
        headers = Headers(result.headers)
        content_type = result.headers.get("content-type", "").casefold()
        response_type = (
            HtmlResponse
            if content_type.startswith(("text/html", "application/xhtml+xml"))
            else TextResponse
        )
        return response_type(
            url=request.url,
            status=result.status,
            headers=headers,
            body=result.body,
            request=request,
        )

    async def download_request(self, request: Request) -> Response:
        target = request.meta.get(TARGET_META)
        if not isinstance(target, EgressTarget):
            raise IgnoreRequest("M08 recusou requisição sem plano de egress.")
        deferred: Deferred[BoundedResponse] = threads.deferToThread(
            self._transport.request,
            target,
            MAX_BODY_BYTES,
        )
        result = await deferred
        return self._response(request, result)

    async def close(self) -> None:
        return None
