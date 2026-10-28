"""Execução Twisted isolada; importar somente após instalar o reactor escolhido."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from scrapy.crawler import Crawler, CrawlerRunner
from twisted.internet import task, threads
from twisted.internet.defer import Deferred, inlineCallbacks
from twisted.python.failure import Failure

from pharmaleads.domain.crawling.service import authorize_checkpoint, prepare_crawl
from pharmaleads.domain.jobs.models import JobRecord
from pharmaleads.domain.jobs.queue import JobQueue, QueueConflictError
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.institutional_spider import InstitutionalSpider
from pharmaleads.infrastructure.site_data_api import SiteDataApiRepository

CHECKPOINT_SECONDS = 20.0
METRIC_KEYS = (
    "m08/pages_parsed",
    "m08/non_html",
    "m08/malformed_jsonld",
    "m08/observation_limit",
    "m08/observations/email",
    "m08/observations/telefone",
    "m08/observations/whatsapp",
    "m08/retry/count",
    "m08/retry_after_seconds",
    "downloader/exception_count",
)
FAIL_REASONS = frozenset(
    {
        "blocked_without_evasion",
        "captcha_without_evasion",
        "http_5xx_exhausted",
        "network_error",
    }
)
SELECT_REACTOR = "twisted.internet.selectreactor.SelectReactor"


def checkpoint_result(crawler: Crawler, spider: InstitutionalSpider) -> dict[str, Any]:
    result = spider.checkpoint()
    stats = crawler.stats.get_stats()
    result["metrics"] = {
        key.removeprefix("m08/"): int(stats.get(key, 0)) for key in METRIC_KEYS
    }
    finish_reason = str(stats.get("finish_reason", "finished"))
    pages = int(stats.get("m08/pages_parsed", 0))
    exception_count = int(stats.get("downloader/exception_count", 0))
    exhausted_5xx = sum(
        int(stats.get(f"downloader/response_status_count/{status}", 0))
        for status in (500, 502, 503, 504)
    )
    if pages == 0 and exception_count:
        finish_reason = "network_error"
    elif pages == 0 and exhausted_5xx:
        finish_reason = "http_5xx_exhausted"
    result["finish_reason"] = finish_reason
    return result


@inlineCallbacks
def crawl_job(
    queue: JobQueue,
    sites: SiteDataApiRepository,
    registry: SourcePolicyRegistry,
    job: JobRecord,
) -> Any:
    plan = prepare_crawl(job, sites, registry)
    runner = CrawlerRunner({"TWISTED_REACTOR": SELECT_REACTOR})
    crawler = runner.create_crawler(InstitutionalSpider)
    crawl = runner.crawl(
        crawler,
        lead_id=plan.lead_id,
        cnpj=plan.cnpj,
        start_url=plan.start_url,
        site_review_version=plan.site_review_version,
        resume=plan.resume,
    )
    heartbeat_errors: list[Failure] = []

    def flush_checkpoint() -> Deferred[JobRecord]:
        spider = crawler.spider
        if not isinstance(spider, InstitutionalSpider):
            raise RuntimeError("Spider M08 não foi inicializado.")
        return threads.deferToThread(
            queue.checkpoint,
            job,
            spider.checkpoint(),
            datetime.now(UTC),
        )

    heartbeat = task.LoopingCall(flush_checkpoint)
    heartbeat_done = heartbeat.start(CHECKPOINT_SECONDS, now=False)

    def remember_failure(failure: Failure) -> None:
        heartbeat_errors.append(failure)

    heartbeat_done.addErrback(remember_failure)
    try:
        yield crawl
    finally:
        if heartbeat.running:
            heartbeat.stop()

    if heartbeat_errors:
        raise QueueConflictError("Checkpoint periódico do M08 perdeu o lease.")
    spider = crawler.spider
    if not isinstance(spider, InstitutionalSpider):
        raise RuntimeError("Spider M08 não retornou estado.")
    result = checkpoint_result(crawler, spider)
    finish_reason = result["finish_reason"]
    if finish_reason in FAIL_REASONS:
        yield threads.deferToThread(queue.checkpoint, job, result, datetime.now(UTC))
        yield threads.deferToThread(queue.fail, job, str(finish_reason), datetime.now(UTC))
        return
    yield threads.deferToThread(authorize_checkpoint, plan, sites, registry)
    yield threads.deferToThread(queue.complete, job, result, datetime.now(UTC))


def run_reactor(
    queue: JobQueue,
    sites: SiteDataApiRepository,
    registry: SourcePolicyRegistry,
    job: JobRecord,
) -> None:
    task.react(lambda _reactor: crawl_job(queue, sites, registry, job))
