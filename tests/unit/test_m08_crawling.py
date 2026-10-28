"""M08: extração institucional, limites e bloqueios sem promoção comercial."""

from __future__ import annotations

import inspect
import subprocess
import sys
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from scrapy import Request
from scrapy.exceptions import CloseSpider, IgnoreRequest
from scrapy.http import HtmlResponse, Response

from pharmaleads.domain.crawling.extract import extract_contacts
from pharmaleads.domain.crawling.links import relevant_links
from pharmaleads.domain.crawling.models import ContactKind
from pharmaleads.domain.crawling.service import authorize_checkpoint, prepare_crawl
from pharmaleads.domain.jobs.models import JobRecord, JobState
from pharmaleads.domain.jobs.queue import ExpectedState
from pharmaleads.domain.sites.linkage import LinkKind
from pharmaleads.domain.sites.models import SiteCandidate, SiteState
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.institutional_spider import InstitutionalSpider
from pharmaleads.infrastructure.m08_cli import repair_succeeded_error, status_payload
from pharmaleads.infrastructure.scrapy_egress import TARGET_META, SafeEgressMiddleware
from pharmaleads.infrastructure.scrapy_retry import retry_after_seconds

PUBLIC_IPV4 = "93.184.216.34"


def public_resolver(_host: str, _port: int) -> tuple[str, ...]:
    return (PUBLIC_IPV4,)


def test_extracts_explicit_email_phone_whatsapp_and_jsonld_without_duplicates() -> None:
    html = """
    <html><body>
      <a href="mailto:Comercial@Exemplo.COM?subject=Contato">E-mail</a>
      <a href="tel:+55 (11) 3333-4444">Telefone</a>
      <a href="https://wa.me/5511999998888">WhatsApp</a>
      <script type="application/ld+json">
        {"@type":"Pharmacy","email":"Comercial@Exemplo.COM","telephone":"+55 (11) 3333-4444"}
      </script>
    </body></html>
    """
    result = extract_contacts(
        html,
        lead_id=60,
        source_id="confirmed_site_http",
        source_url="https://exemplo.com.br/",
        observed_at=datetime(2026, 10, 27, tzinfo=UTC),
    )
    assert [(item.kind, item.raw_value) for item in result.observations] == [
        (ContactKind.EMAIL, "Comercial@exemplo.com"),
        (ContactKind.PHONE, "+55 (11) 3333-4444"),
        (ContactKind.WHATSAPP, "5511999998888"),
    ]
    assert all(len(item.evidence_hash) == 64 for item in result.observations)


def test_empty_and_broken_html_produce_no_false_contact() -> None:
    result = extract_contacts(
        '<html><script type="application/ld+json">{broken</script>texto@solto.com</html>',
        lead_id=1,
        source_id="confirmed_site_http",
        source_url="https://exemplo.com.br/",
        observed_at=datetime(2026, 10, 27, tzinfo=UTC),
    )
    assert result.observations == ()
    assert result.malformed_jsonld == 1


def test_relevant_links_stay_on_confirmed_host_and_drop_queries() -> None:
    html = """
      <a href="/contato?utm_source=x">Fale conosco</a>
      <a href="https://exemplo.com.br/produto">Produto</a>
      <a href="https://terceiro.example/contato">Contato externo</a>
      <a href="mailto:a@b.com">E-mail</a>
    """
    assert relevant_links(
        html,
        source_url="https://exemplo.com.br/",
        confirmed_host="exemplo.com.br",
    ) == ("https://exemplo.com.br/contato",)


def test_egress_middleware_pins_public_target_and_blocks_private_or_other_host() -> None:
    spider = SimpleNamespace(confirmed_host="exemplo.com.br")
    request = Request("https://exemplo.com.br/contato")
    crawler = SimpleNamespace(spider=spider)
    SafeEgressMiddleware(public_resolver, crawler).process_request(request)  # type: ignore[arg-type]
    assert request.meta[TARGET_META].addresses == (PUBLIC_IPV4,)

    with pytest.raises(IgnoreRequest):
        SafeEgressMiddleware(
            lambda _host, _port: ("127.0.0.1",), crawler  # type: ignore[arg-type]
        ).process_request(Request("https://exemplo.com.br/"))
    with pytest.raises(IgnoreRequest):
        SafeEgressMiddleware(public_resolver, crawler).process_request(  # type: ignore[arg-type]
            Request("https://outro.example/contato")
        )

    secure_spider = SimpleNamespace(confirmed_host="exemplo.com.br", confirmed_scheme="https")
    secure_crawler = SimpleNamespace(spider=secure_spider)
    with pytest.raises(IgnoreRequest, match="downgrade"):
        SafeEgressMiddleware(public_resolver, secure_crawler).process_request(  # type: ignore[arg-type]
            Request("http://exemplo.com.br/contato")
        )


def test_scrapy_extensions_use_current_coroutine_interfaces() -> None:
    from pharmaleads.infrastructure.scrapy_egress import SafePinnedDownloadHandler

    assert SafePinnedDownloadHandler.lazy is True
    assert inspect.iscoroutinefunction(SafePinnedDownloadHandler.download_request)
    assert inspect.iscoroutinefunction(SafePinnedDownloadHandler.close)


@pytest.mark.parametrize(
    ("header", "expected"),
    [(b"12", 12), (b"999", 60), (b"invalid", 1), (None, 1)],
)
def test_retry_after_is_bounded(header: bytes | None, expected: int) -> None:
    assert retry_after_seconds(header, datetime(2026, 10, 27, tzinfo=UTC)) == expected


class RecordingStats:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}

    def inc_value(self, key: str, count: int = 1, **_kwargs: Any) -> None:
        self.values[key] = self.values.get(key, 0) + count


def _spider() -> InstitutionalSpider:
    spider = InstitutionalSpider(
        60,
        "40809626000168",
        f"https://{PUBLIC_IPV4}/",
        site_review_version=2,
    )
    spider.crawler = SimpleNamespace(stats=RecordingStats())  # type: ignore[assignment]
    return spider


def test_spider_collects_observations_and_schedules_only_relevant_page() -> None:
    spider = _spider()
    request = Request(f"https://{PUBLIC_IPV4}/", meta={"depth": 0})
    response = HtmlResponse(
        request.url,
        request=request,
        encoding="utf-8",
        body=b'<a href="tel:08009702244">SAC</a><a href="/contato">Contato</a>',
    )
    scheduled = list(spider.parse(response))
    assert [item.raw_value for item in spider.observations] == ["08009702244"]
    assert [item.url for item in scheduled] == [f"https://{PUBLIC_IPV4}/contato"]
    assert spider.crawler.stats.values["m08/pages_parsed"] == 1


@pytest.mark.parametrize(
    "response",
    [
        Response(f"https://{PUBLIC_IPV4}/", status=403),
        HtmlResponse(
            f"https://{PUBLIC_IPV4}/",
            encoding="utf-8",
            body=(
                b"<html><title>Security check</title><body>Verify you are human"
                b"<div class='h-captcha'></div></body></html>"
            ),
        ),
    ],
)
def test_403_and_captcha_pause_without_evasion(response: Response) -> None:
    spider = _spider()
    with pytest.raises(CloseSpider):
        list(spider.parse(response))


def test_captcha_library_reference_on_normal_page_is_not_a_challenge() -> None:
    spider = _spider()
    request = Request(f"https://{PUBLIC_IPV4}/", meta={"depth": 0})
    response = HtmlResponse(
        request.url,
        request=request,
        encoding="utf-8",
        body=(
            b"<html><body><script>window.grecaptcha = window.grecaptcha || {};</script>"
            b'<a href="mailto:sac@example.com">Contato</a></body></html>'
        ),
    )
    list(spider.parse(response))
    assert [item.raw_value for item in spider.observations] == ["sac@example.com"]


def test_spider_settings_enforce_polite_bounded_crawl() -> None:
    settings = InstitutionalSpider.custom_settings
    assert settings is not None
    assert settings["ROBOTSTXT_OBEY"] is True
    assert settings["CONCURRENT_REQUESTS_PER_DOMAIN"] == 1
    assert settings["DEPTH_LIMIT"] == 1
    assert settings["CLOSESPIDER_PAGECOUNT"] == 10
    assert 403 not in settings["RETRY_HTTP_CODES"]


def test_spider_checkpoint_resumes_pending_pages_without_duplicate_observations() -> None:
    first = _spider()
    root = Request(f"https://{PUBLIC_IPV4}/", meta={"depth": 0})
    response = HtmlResponse(
        root.url,
        request=root,
        encoding="utf-8",
        body=b'<a href="mailto:contato@example.com">E-mail</a><a href="/contato">Contato</a>',
    )
    assert len(list(first.parse(response))) == 1
    checkpoint = first.checkpoint()

    resumed = InstitutionalSpider(
        60,
        "40809626000168",
        f"https://{PUBLIC_IPV4}/",
        site_review_version=2,
        resume=checkpoint,
    )
    requests = list(resumed.initial_requests())
    assert [request.url for request in requests] == [f"https://{PUBLIC_IPV4}/contato"]
    assert [item.raw_value for item in resumed.observations] == ["contato@example.com"]
class FakeSites:
    def __init__(self, site: SiteCandidate) -> None:
        self.site = site

    def get(self, _lead_id: int) -> SiteCandidate:
        return self.site

    def confirmed_website(self, _lead_id: int) -> str:
        assert self.site.final_url is not None
        return self.site.final_url


def _confirmed_site() -> SiteCandidate:
    return SiteCandidate(
        lead_id=60,
        cnpj="40809626000168",
        source_id="manual_site_candidate",
        candidate_url=f"https://{PUBLIC_IPV4}/",
        final_url=f"https://{PUBLIC_IPV4}/",
        state=SiteState.CONFIRMED,
        link_kind=LinkKind.BRANCH_EXACT,
        version=2,
    )


def _crawl_job() -> JobRecord:
    return JobRecord(
        lead_id=60,
        cnpj="40809626000168",
        state=JobState.RUNNING,
        job_id=uuid4(),
        kind="crawl_http",
        payload={"source_id": "confirmed_site_http", "site_review_version": 2},
        fence=3,
        worker="m08-test",
        lease_until=datetime(2026, 10, 27, 12, tzinfo=UTC),
    )


def test_crawl_plan_requires_current_confirmed_site_and_rechecks_before_checkpoint() -> None:
    sites = FakeSites(_confirmed_site())
    registry = SourcePolicyRegistry()
    plan = prepare_crawl(_crawl_job(), sites, registry)
    assert plan.start_url == f"https://{PUBLIC_IPV4}/"
    authorize_checkpoint(plan, sites, registry)

    sites.site = SiteCandidate(
        **{**sites.site.__dict__, "version": 3},
    )
    with pytest.raises(ValueError, match="mudou durante"):
        authorize_checkpoint(plan, sites, registry)


def test_packaged_policy_allows_only_collection_and_checkpoint_persistence() -> None:
    policy = SourcePolicyRegistry().snapshot()
    for field in ("site_page", "email", "telefone", "whatsapp"):
        assert policy.allowed("confirmed_site_http", field, PolicyAction.COLETAR)
        assert not policy.allowed("confirmed_site_http", field, PolicyAction.PERSISTIR)
    assert policy.allowed("confirmed_site_http", "job_checkpoint", PolicyAction.PERSISTIR)
    assert not policy.allowed("confirmed_site_http", "email", PolicyAction.EXPORTAR)


def test_controlled_server_crawl_runs_in_isolated_reactor() -> None:
    root = Path(__file__).parents[2]
    result = subprocess.run(
        [sys.executable, str(root / "ops" / "verify_m08_controlled.py")],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert '"observations": 3' in result.stdout
    assert '"pages_parsed": 2' in result.stdout


def test_status_reports_counts_without_exposing_contact_values() -> None:
    job = _crawl_job()
    job = JobRecord(
        **{
            **job.__dict__,
            "checkpoint": {
                "finish_reason": "finished",
                "metrics": {"pages_parsed": 2},
                "observations": [
                    {"kind": "email", "raw_value": "secret@example.com"},
                    {"kind": "telefone", "raw_value": "551133334444"},
                ],
            },
        }
    )
    payload = status_payload(job)
    assert payload["contact_counts"] == {"email": 1, "telefone": 1}
    assert "secret@example.com" not in repr(payload)


def test_repair_clears_only_stale_error_from_succeeded_job() -> None:
    class Backend:
        def __init__(self, record: JobRecord) -> None:
            self.record = record
            self.changes: dict[str, Any] = {}

        def by_id(self, _lead_id: int) -> JobRecord:
            return self.record

        def by_cnpj(self, _cnpj: str) -> JobRecord | None:
            return None

        def claimable(self, _now: datetime, _limit: int) -> list[JobRecord]:
            return []

        def expired(self, _now: datetime, _limit: int) -> list[JobRecord]:
            return []

        def compare_and_set(
            self,
            _lead_id: int,
            expected: ExpectedState,
            changes: dict[str, Any],
            _now: datetime,
        ) -> JobRecord | None:
            assert expected == ExpectedState(JobState.SUCCEEDED, 3)
            self.changes = changes
            self.record = replace(self.record, **changes)
            return self.record

    backend = Backend(
        replace(
            _crawl_job(),
            state=JobState.SUCCEEDED,
            worker=None,
            lease_until=None,
            error_code="captcha_without_evasion",
        )
    )
    repaired, changed = repair_succeeded_error(
        backend,
        60,
        datetime(2026, 10, 27, 15, tzinfo=UTC),
    )
    assert changed is True
    assert repaired.error_code is None
    assert set(backend.changes) == {"error_code", "updated_at"}
