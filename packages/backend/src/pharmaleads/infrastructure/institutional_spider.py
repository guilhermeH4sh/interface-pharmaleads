"""Spider M08 restrito ao domínio já confirmado no M07."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from typing import Any

from scrapy import Request, Spider
from scrapy.exceptions import CloseSpider
from scrapy.http import HtmlResponse, Response

from pharmaleads.domain.crawling.extract import EXTRACTOR_VERSION, extract_contacts
from pharmaleads.domain.crawling.links import relevant_links
from pharmaleads.domain.crawling.models import ObservationCandidate
from pharmaleads.domain.sites.security import plan_egress
from pharmaleads.infrastructure.site_http import MAX_BODY_BYTES

SOURCE_ID = "confirmed_site_http"
CHALLENGE_TEXT = (
    "verify you are human",
    "verifique se você é humano",
    "verifique que você é humano",
    "checking your browser",
    "checando seu navegador",
    "complete the security check",
)
CHALLENGE_WIDGETS = (
    ".g-recaptcha",
    ".h-captcha",
    "[class~='hcaptcha']",
    "iframe[src*='recaptcha']",
    "iframe[src*='hcaptcha']",
)
CHALLENGE_SHELLS = ("form#challenge-form", "[id^='cf-chl-']", "[class*='cf-chl-']")
MAX_OBSERVATIONS = 50
MAX_CHECKPOINT_URLS = 10


class InstitutionalSpider(Spider):
    name = "pharmaleads_institutional"
    handle_httpstatus_list = [403, 429]
    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "COOKIES_ENABLED": False,
        "TELNETCONSOLE_ENABLED": False,
        "REMOTE_CONTROL_ENABLED": False,
        "CONCURRENT_REQUESTS": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 0.5,
        "DOWNLOAD_TIMEOUT": 10,
        "DOWNLOAD_MAXSIZE": MAX_BODY_BYTES,
        "DOWNLOAD_WARNSIZE": MAX_BODY_BYTES,
        "DEPTH_LIMIT": 1,
        "CLOSESPIDER_PAGECOUNT": 10,
        "REDIRECT_MAX_TIMES": 5,
        "RETRY_TIMES": 2,
        "RETRY_HTTP_CODES": [408, 500, 502, 503, 504],
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.5,
        "AUTOTHROTTLE_MAX_DELAY": 10.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 1.0,
        "USER_AGENT": "PharmaLeads-M08/1.0 (+contato institucional)",
        "DOWNLOADER_MIDDLEWARES": {
            "pharmaleads.infrastructure.scrapy_egress.SafeEgressMiddleware": 50,
            "pharmaleads.infrastructure.scrapy_retry.RetryAfterMiddleware": 545,
        },
        "DOWNLOAD_HANDLERS": {
            "http": "pharmaleads.infrastructure.scrapy_egress.SafePinnedDownloadHandler",
            "https": "pharmaleads.infrastructure.scrapy_egress.SafePinnedDownloadHandler",
        },
        "LOG_ENABLED": False,
    }

    def __init__(
        self,
        lead_id: int | str,
        cnpj: str,
        start_url: str,
        site_review_version: int | str,
        resume: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        target = plan_egress(start_url)
        self.lead_id = int(lead_id)
        if self.lead_id < 1:
            raise ValueError("Lead do crawl inválido.")
        self.cnpj = cnpj
        self.site_review_version = int(site_review_version)
        if self.site_review_version < 1:
            raise ValueError("Versão confirmada do site inválida.")
        self.start_url = target.url
        self.confirmed_host = target.host
        self.confirmed_scheme = target.scheme
        self.observations: list[ObservationCandidate] = []
        self._seen_observations: set[tuple[str, str]] = set()
        self._visited_urls: set[str] = set()
        self._pending_urls: set[str] = {self.start_url}
        self._restore(resume or {})

    def _restore(self, resume: dict[str, Any]) -> None:
        if not resume:
            return
        if (
            resume.get("handler") != "institutional_http"
            or resume.get("source_id") != SOURCE_ID
            or resume.get("site_review_version") != self.site_review_version
        ):
            raise ValueError("Checkpoint M08 não pertence ao site confirmado atual.")
        observations = resume.get("observations", [])
        pending = resume.get("pending_urls", [])
        visited = resume.get("visited_urls", [])
        if not isinstance(observations, list) or len(observations) > MAX_OBSERVATIONS:
            raise ValueError("Checkpoint M08 excede observações permitidas.")
        if not isinstance(pending, list) or not isinstance(visited, list):
            raise ValueError("Checkpoint M08 possui URLs inválidas.")
        if len(pending) > MAX_CHECKPOINT_URLS or len(visited) > MAX_CHECKPOINT_URLS:
            raise ValueError("Checkpoint M08 excede URLs permitidas.")
        self.observations = [ObservationCandidate.from_checkpoint(item) for item in observations]
        if any(
            item.lead_id != self.lead_id or item.source_id != SOURCE_ID
            for item in self.observations
        ):
            raise ValueError("Checkpoint M08 pertence a outro lead ou fonte.")
        self._seen_observations = {
            (item.kind.value, item.raw_value) for item in self.observations
        }
        self._visited_urls = self._valid_checkpoint_urls(visited)
        restored_pending = self._valid_checkpoint_urls(pending)
        self._pending_urls = restored_pending or ({self.start_url} - self._visited_urls)

    def _valid_checkpoint_urls(self, values: list[Any]) -> set[str]:
        valid: set[str] = set()
        for value in values:
            if not isinstance(value, str):
                raise ValueError("Checkpoint M08 possui URL inválida.")
            target = plan_egress(value)
            if target.host != self.confirmed_host:
                raise ValueError("Checkpoint M08 saiu do domínio confirmado.")
            valid.add(target.url)
        return valid

    async def start(self) -> AsyncIterator[Request]:
        for request in self.initial_requests():
            yield request

    def initial_requests(self) -> Iterator[Request]:
        for url in sorted(self._pending_urls):
            yield Request(url, callback=self.parse, meta={"depth": 0})

    def checkpoint(self) -> dict[str, Any]:
        return {
            "handler": "institutional_http",
            "source_id": SOURCE_ID,
            "site_review_version": self.site_review_version,
            "extractor_version": EXTRACTOR_VERSION,
            "observations": [item.checkpoint() for item in self.observations],
            "pending_urls": sorted(self._pending_urls)[:MAX_CHECKPOINT_URLS],
            "visited_urls": sorted(self._visited_urls)[:MAX_CHECKPOINT_URLS],
        }

    @staticmethod
    def _challenge_page(response: HtmlResponse) -> bool:
        if any(response.css(selector) for selector in CHALLENGE_SHELLS):
            return True
        title = " ".join(response.css("title::text").getall()).strip().casefold()
        visible_text = " ".join(response.css("body ::text").getall())[:100_000].casefold()
        has_challenge_text = "just a moment" in title or any(
            phrase in visible_text for phrase in CHALLENGE_TEXT
        )
        has_widget = any(response.css(selector) for selector in CHALLENGE_WIDGETS)
        return has_challenge_text and has_widget

    def parse(self, response: Response) -> Iterator[Request]:
        if response.status in {403, 429}:
            self.crawler.stats.inc_value(f"m08/paused_http_{response.status}")
            raise CloseSpider("blocked_without_evasion")
        if not isinstance(response, HtmlResponse):
            self.crawler.stats.inc_value("m08/non_html")
            self._pending_urls.discard(response.url)
            self._visited_urls.add(response.url)
            return
        if self._challenge_page(response):
            self.crawler.stats.inc_value("m08/captcha_paused")
            raise CloseSpider("captcha_without_evasion")

        result = extract_contacts(
            response.text,
            lead_id=self.lead_id,
            source_id=SOURCE_ID,
            source_url=response.url,
            observed_at=datetime.now(UTC),
        )
        self.crawler.stats.inc_value("m08/pages_parsed")
        self._pending_urls.discard(response.url)
        self._visited_urls.add(response.url)
        self.crawler.stats.inc_value("m08/malformed_jsonld", result.malformed_jsonld)
        for observation in result.observations:
            key = (observation.kind.value, observation.raw_value)
            if key not in self._seen_observations:
                if len(self.observations) >= MAX_OBSERVATIONS:
                    self.crawler.stats.inc_value("m08/observation_limit")
                    break
                self._seen_observations.add(key)
                self.observations.append(observation)
                self.crawler.stats.inc_value(f"m08/observations/{observation.kind.value}")

        if int(response.meta.get("depth", 0)) >= 1:
            return
        for url in relevant_links(
            response.text,
            source_url=response.url,
            confirmed_host=self.confirmed_host,
        ):
            if url not in self._visited_urls:
                self._pending_urls.add(url)
                yield Request(url, callback=self.parse)
