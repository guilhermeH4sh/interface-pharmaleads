"""Retry limitado de HTTP 429 com respeito ao Retry-After."""

from __future__ import annotations

from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from scrapy import Request, Spider
from scrapy.crawler import Crawler
from scrapy.downloadermiddlewares.retry import get_retry_request
from scrapy.http import Response
from scrapy.utils.asyncio import sleep

MAX_RETRY_AFTER_SECONDS = 60


def retry_after_seconds(value: bytes | str | None, now: datetime | None = None) -> int:
    if value is None:
        return 1
    text = value.decode("ascii", errors="ignore") if isinstance(value, bytes) else value
    candidate = text.strip()
    if candidate.isdigit():
        return max(1, min(MAX_RETRY_AFTER_SECONDS, int(candidate)))
    try:
        target = parsedate_to_datetime(candidate)
    except (TypeError, ValueError):
        return 1
    if target.tzinfo is None:
        target = target.replace(tzinfo=UTC)
    instant = (now or datetime.now(UTC)).astimezone(UTC)
    seconds = int((target.astimezone(UTC) - instant).total_seconds())
    return max(1, min(MAX_RETRY_AFTER_SECONDS, seconds))


class RetryAfterMiddleware:
    def __init__(self, crawler: Crawler) -> None:
        self._crawler = crawler

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> RetryAfterMiddleware:
        return cls(crawler)

    async def process_response(
        self,
        request: Request,
        response: Response,
    ) -> Request | Response:
        if response.status != 429:
            return response
        spider = self._crawler.spider
        if not isinstance(spider, Spider):
            return response
        retry = get_retry_request(
            request,
            spider=spider,
            reason="http_429_retry_after",
            max_retry_times=2,
            stats_base_key="m08/retry",
        )
        if retry is None:
            return response
        delay = retry_after_seconds(response.headers.get(b"Retry-After"))
        spider.crawler.stats.inc_value("m08/retry_after_seconds", delay)
        await sleep(delay)
        return retry
