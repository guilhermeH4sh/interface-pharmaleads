"""M07: URL segura, vínculo por CNPJ e revisão concorrente."""

from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

import pytest

from pharmaleads.domain.sites.candidates import CandidateFileError, read_candidate_csv
from pharmaleads.domain.sites.linkage import LinkKind, assess_cnpj_link
from pharmaleads.domain.sites.models import SiteState
from pharmaleads.domain.sites.security import (
    EgressTarget,
    UrlSecurityError,
    plan_egress,
    plan_redirect,
)
from pharmaleads.domain.sites.workflow import ReviewConflictError, SiteWorkflow
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.m07_audit_cli import (
    EXPECTED_FIELDS,
    M07AuditError,
    load_expected,
)
from pharmaleads.infrastructure.m07_audit_cli import audit as audit_pilot
from pharmaleads.infrastructure.m07_verify_cli import verify as verify_remote_review
from pharmaleads.infrastructure.site_cli import main as site_main
from pharmaleads.infrastructure.site_data_api import SiteDataApiError, SiteDataApiRepository
from pharmaleads.infrastructure.site_http import (
    BoundedResponse,
    SafeSiteInspector,
    SiteInspectionError,
)

CNPJ = "11222333000181"
SAME_NETWORK_CNPJ = "11222333000262"
PUBLIC_IPV4 = "93.184.216.34"


def public_resolver(_host: str, _port: int) -> tuple[str, ...]:
    return (PUBLIC_IPV4, "2606:4700:4700::1111")


def test_url_is_normalized_and_all_resolved_addresses_are_public() -> None:
    target = plan_egress(" HTTPS://Exemplo.COM.br/caminho?q=1 ", public_resolver)
    assert target.url == "https://exemplo.com.br/caminho?q=1"
    assert target.port == 443
    assert target.addresses == (PUBLIC_IPV4, "2606:4700:4700::1111")


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://169.254.169.254/latest/meta-data/",
        "file:///etc/passwd",
        "https://usuario:senha@exemplo.com.br/",
        "https://localhost/",
        "https://exemplo.com.br:8443/",
    ],
)
def test_arbitrary_or_private_urls_are_blocked(url: str) -> None:
    with pytest.raises(UrlSecurityError):
        plan_egress(url, public_resolver)


def test_dns_answer_with_any_private_address_is_blocked() -> None:
    def rebound(_host: str, _port: int) -> tuple[str, ...]:
        return (PUBLIC_IPV4, "10.0.0.7")

    with pytest.raises(UrlSecurityError, match="privado"):
        plan_egress("https://exemplo.com.br", rebound)


def test_redirect_is_resolved_and_private_destination_is_blocked() -> None:
    with pytest.raises(UrlSecurityError, match="privado"):
        plan_redirect("https://exemplo.com.br", "http://192.168.1.10/admin", public_resolver)


def test_linkage_classifies_branch_network_other_company_and_missing() -> None:
    exact = assess_cnpj_link(CNPJ, "CNPJ 11.222.333/0001-81")
    network = assess_cnpj_link(CNPJ, f"Filial: {SAME_NETWORK_CNPJ}")
    other = assess_cnpj_link(CNPJ, "CNPJ 04.252.011/0001-10")
    missing = assess_cnpj_link(CNPJ, "Farmácia sem CNPJ publicado")
    assert exact.kind == LinkKind.BRANCH_EXACT and exact.strong
    assert network.kind == LinkKind.SAME_NETWORK
    assert other.kind == LinkKind.OTHER_COMPANY
    assert missing.kind == LinkKind.UNCONFIRMED


def test_candidate_requires_review_before_confirmation() -> None:
    target = plan_egress("https://exemplo.com.br", public_resolver)
    candidate = SiteWorkflow.propose(1, CNPJ, "manual_site_candidate", target)
    assert candidate.state == SiteState.CANDIDATE
    inspected = SiteWorkflow.inspect(
        candidate,
        target,
        assess_cnpj_link(CNPJ, "CNPJ 11.222.333/0001-81"),
        redirect_count=0,
    )
    confirmed = SiteWorkflow.review(
        inspected,
        expected_version=1,
        reviewer="revisor-1",
        approve=True,
        now=datetime(2026, 10, 26, 12, tzinfo=UTC),
    )
    assert confirmed.state == SiteState.CONFIRMED
    assert confirmed.version == 2
    assert confirmed.final_url == "https://exemplo.com.br/"


def test_ambiguous_link_cannot_be_confirmed_as_branch() -> None:
    target = plan_egress("https://rede.example", public_resolver)
    candidate = SiteWorkflow.propose(1, CNPJ, "manual_site_candidate", target)
    inspected = SiteWorkflow.inspect(
        candidate,
        target,
        assess_cnpj_link(CNPJ, SAME_NETWORK_CNPJ),
        redirect_count=0,
    )
    with pytest.raises(ReviewConflictError, match="CNPJ exato"):
        SiteWorkflow.review(
            inspected,
            expected_version=1,
            reviewer="revisor-1",
            approve=True,
            now=datetime(2026, 10, 26, 12, tzinfo=UTC),
        )


def test_concurrent_review_with_stale_version_is_rejected() -> None:
    target = plan_egress("https://exemplo.com.br", public_resolver)
    inspected = SiteWorkflow.inspect(
        SiteWorkflow.propose(1, CNPJ, "manual_site_candidate", target),
        target,
        assess_cnpj_link(CNPJ, CNPJ),
        redirect_count=0,
    )
    with pytest.raises(ReviewConflictError, match="concorrência"):
        SiteWorkflow.review(
            inspected,
            expected_version=0,
            reviewer="revisor-2",
            approve=False,
            now=datetime(2026, 10, 26, 12, tzinfo=UTC),
        )


class FakeTransport:
    def __init__(self, responses: dict[str, BoundedResponse]) -> None:
        self.responses = responses
        self.targets: list[str] = []

    def request(self, target: EgressTarget, _max_body_bytes: int) -> BoundedResponse:
        self.targets.append(target.url)
        return self.responses[target.url]


def test_http_inspector_revalidates_redirect_and_finds_exact_cnpj() -> None:
    transport = FakeTransport(
        {
            "http://exemplo.com.br/": BoundedResponse(
                301, {"location": "https://www.exemplo.com.br/institucional"}, b""
            ),
            "https://www.exemplo.com.br/institucional": BoundedResponse(
                200,
                {"content-type": "text/html; charset=utf-8"},
                b"<html>CNPJ 11.222.333/0001-81</html>",
            ),
        }
    )
    result = SafeSiteInspector(transport, resolver=public_resolver).inspect(
        "http://exemplo.com.br", CNPJ
    )
    assert result.assessment.kind == LinkKind.BRANCH_EXACT
    assert result.redirect_chain == ("https://www.exemplo.com.br/institucional",)
    assert transport.targets == [
        "http://exemplo.com.br/",
        "https://www.exemplo.com.br/institucional",
    ]


def test_http_inspector_accepts_bounded_large_html_and_finds_formatted_cnpj() -> None:
    body = b"<html>" + (b"x" * 330_000) + b"CNPJ 11.222.333/0001-81</html>"
    transport = FakeTransport(
        {
            "https://exemplo.com.br/": BoundedResponse(
                200,
                {"content-type": "text/html; charset=utf-8"},
                body,
            )
        }
    )
    result = SafeSiteInspector(transport, resolver=public_resolver).inspect(
        "https://exemplo.com.br", CNPJ
    )
    assert result.assessment.kind == LinkKind.BRANCH_EXACT


def test_http_inspector_blocks_https_downgrade() -> None:
    transport = FakeTransport(
        {
            "https://exemplo.com.br/": BoundedResponse(
                302, {"location": "http://exemplo.com.br/"}, b""
            )
        }
    )
    with pytest.raises(UrlSecurityError, match="HTTPS para HTTP"):
        SafeSiteInspector(transport, resolver=public_resolver).inspect(
            "https://exemplo.com.br", CNPJ
        )


def test_http_inspector_blocks_redirect_cycle_and_non_html() -> None:
    cycle = FakeTransport({"https://exemplo.com.br/": BoundedResponse(302, {"location": "/"}, b"")})
    with pytest.raises(SiteInspectionError, match="Ciclo"):
        SafeSiteInspector(cycle, resolver=public_resolver).inspect("https://exemplo.com.br", CNPJ)
    non_html = FakeTransport(
        {
            "https://exemplo.com.br/": BoundedResponse(
                200, {"content-type": "application/pdf"}, b"pdf"
            )
        }
    )
    with pytest.raises(SiteInspectionError, match="não é HTML"):
        SafeSiteInspector(non_html, resolver=public_resolver).inspect(
            "https://exemplo.com.br", CNPJ
        )


def test_site_data_api_save_uses_state_and_version_cas() -> None:
    class RecordingRepository(SiteDataApiRepository):
        def __init__(self) -> None:
            self.recorded: tuple[str, dict[str, str], dict[str, Any] | None] | None = None

        def _request(
            self,
            method: str,
            query: dict[str, str],
            payload: dict[str, Any] | None = None,
        ) -> list[dict[str, Any]]:
            self.recorded = (method, query, payload)
            assert payload is not None
            return [
                {
                    "id": 1,
                    "cnpj": CNPJ,
                    "website": None,
                    "site_candidate_url": payload["site_candidate_url"],
                    "site_resolved_url": payload["site_resolved_url"],
                    "site_source_id": payload["site_source_id"],
                    "site_state": payload["site_state"],
                    "site_link_kind": payload["site_link_kind"],
                    "site_evidence": payload["site_evidence"],
                    "site_review_version": payload["site_review_version"],
                    "site_reviewed_by": payload["site_reviewed_by"],
                    "site_reviewed_at": payload["site_reviewed_at"],
                }
            ]

    candidate = SiteWorkflow.propose(
        1,
        CNPJ,
        "manual_site_candidate",
        plan_egress("https://exemplo.com.br", public_resolver),
    )
    repository = RecordingRepository()
    saved = repository.save(candidate, expected_state=None, expected_version=0)
    assert saved.state == SiteState.CANDIDATE
    assert repository.recorded is not None
    method, query, payload = repository.recorded
    assert method == "PATCH"
    assert query["site_state"] == "is.null"
    assert query["site_review_version"] == "eq.0"
    assert payload is not None and not any(key.startswith("job_") for key in payload)


def test_site_data_api_rejects_incomplete_remote_candidate() -> None:
    class IncompleteRepository(SiteDataApiRepository):
        def __init__(self) -> None:
            pass

        def _request(
            self,
            _method: str,
            _query: dict[str, str],
            _payload: dict[str, Any] | None = None,
        ) -> list[dict[str, Any]]:
            return [{"id": 1, "cnpj": CNPJ, "site_state": "candidate"}]

    with pytest.raises(SiteDataApiError, match="Resposta de site inválida"):
        IncompleteRepository().get(1)


def test_remote_review_has_one_cas_winner_and_confirms_website() -> None:
    target = plan_egress("https://exemplo.com.br", public_resolver)
    inspected = SiteWorkflow.inspect(
        SiteWorkflow.propose(1, CNPJ, "manual_site_candidate", target),
        target,
        assess_cnpj_link(CNPJ, CNPJ),
        redirect_count=0,
    )

    class ConcurrentRepository:
        def __init__(self) -> None:
            self.current = inspected
            self.lock = Lock()

        def get(self, _lead_id: int) -> Any:
            return self.current

        def save(
            self,
            candidate: Any,
            *,
            expected_state: SiteState | None,
            expected_version: int,
        ) -> Any:
            with self.lock:
                if self.current.state != expected_state or self.current.version != expected_version:
                    raise SiteDataApiError("Gravação de site perdeu a concorrência.")
                self.current = replace(candidate)
                return self.current

        def confirmed_website(self, _lead_id: int) -> str:
            assert self.current.final_url is not None
            return self.current.final_url

    result = verify_remote_review(
        ConcurrentRepository(),
        SourcePolicyRegistry(),
        lead_id=1,
        expected_version=1,
    )
    assert result["reviews_started"] == 2
    assert result["reviews_won"] == 1
    assert result["final_state"] == "confirmed"
    assert result["website_confirmed"] is True


def test_m07_sql_only_alters_pharmaleads_and_adds_no_object() -> None:
    sql = (Path(__file__).parents[2] / "ops" / "sql" / "m07-add-site-columns.sql").read_text(
        encoding="utf-8"
    )
    normalized = " ".join(sql.lower().split())
    assert "alter table public.pharmaleads" in normalized
    assert "create table" not in normalized
    assert "create function" not in normalized
    assert "create trigger" not in normalized
    assert "create index" not in normalized
    assert " drop table" not in normalized
    assert " cascade" not in normalized


def test_manual_site_source_is_explicit_and_deny_by_default() -> None:
    registry = SourcePolicyRegistry()
    policy = registry.snapshot()
    assert policy.allowed("manual_site_candidate", "website", PolicyAction.COLETAR)
    assert policy.allowed("manual_site_candidate", "site_workflow", PolicyAction.PERSISTIR)
    assert not policy.allowed("manual_site_candidate", "telefone", PolicyAction.PERSISTIR)
    assert not policy.allowed("provedor_nao_aprovado", "website", PolicyAction.COLETAR)


def test_review_cli_is_dry_run_by_default(capsys: pytest.CaptureFixture[str]) -> None:
    assert (
        site_main(
            [
                "revisar",
                "--lead-id",
                "1",
                "--expected-version",
                "1",
                "--reviewer",
                "revisor-fixture",
                "--decision",
                "approve",
            ]
        )
        == 0
    )
    assert capsys.readouterr().out == '{"lead_id": 1, "mode": "dry-run", "writes": 0}\n'


def test_candidate_csv_validates_all_rows_before_use(tmp_path: Path) -> None:
    candidate_file = tmp_path / "sites.csv"
    candidate_file.write_text(
        f"lead_id,cnpj,url,source_id\n1,{CNPJ},https://93.184.216.34,manual_site_candidate\n",
        encoding="utf-8",
    )
    records = read_candidate_csv(candidate_file)
    assert len(records) == 1
    assert records[0].lead_id == 1
    assert records[0].cnpj == CNPJ


def test_candidate_csv_rejects_duplicate_lead_and_cli_stays_read_only(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    duplicate = tmp_path / "duplicate.csv"
    duplicate.write_text(
        "lead_id,cnpj,url,source_id\n"
        f"1,{CNPJ},https://93.184.216.34,manual_site_candidate\n"
        f"1,{CNPJ},https://93.184.216.34/outro,manual_site_candidate\n",
        encoding="utf-8",
    )
    with pytest.raises(CandidateFileError, match="candidato inválido"):
        read_candidate_csv(duplicate)

    valid = tmp_path / "valid.csv"
    valid.write_text(
        f"lead_id,cnpj,url,source_id\n1,{CNPJ},https://93.184.216.34,manual_site_candidate\n",
        encoding="utf-8",
    )
    assert site_main(["validar-arquivo", "--file", str(valid)]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["rows"] == 1
    assert output["writes"] == 0


def _audit_fixture() -> tuple[list[dict[str, str]], list[dict[str, Any]], list[dict[str, Any]]]:
    expected = [
        {field: f"{field}-{lead_id}" for field in EXPECTED_FIELDS} for lead_id in range(1, 101)
    ]
    core_rows = [{"id": lead_id, **record} for lead_id, record in enumerate(expected, start=1)]
    site_rows: list[dict[str, Any]] = []
    for lead_id in range(1, 101):
        site_rows.append(
            {
                "id": lead_id,
                "website": None,
                "site_candidate_url": None,
                "site_resolved_url": None,
                "site_source_id": None,
                "site_state": None,
                "site_link_kind": None,
                "site_evidence": {},
                "site_review_version": 0,
                "site_reviewed_by": None,
                "site_reviewed_at": None,
                "site_updated_at": None,
            }
        )
    site_rows[59].update(
        {
            "website": "https://fdc.com.br/",
            "site_candidate_url": "https://fdc.com.br/",
            "site_resolved_url": "https://fdc.com.br/",
            "site_source_id": "manual_site_candidate",
            "site_state": "confirmed",
            "site_link_kind": "branch_exact",
            "site_evidence": {"observed_cnpjs": ["40809626000168"]},
            "site_review_version": 2,
            "site_reviewed_by": "m07-review-a",
            "site_reviewed_at": "2026-10-27T00:00:00+00:00",
            "site_updated_at": "2026-10-27T00:00:00+00:00",
        }
    )
    return expected, core_rows, site_rows


def test_pilot_audit_compares_100_rows_and_only_one_confirmed_site(tmp_path: Path) -> None:
    expected, core_rows, site_rows = _audit_fixture()
    source = tmp_path / "records.ndjson"
    source.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in expected),
        encoding="utf-8",
    )
    result = audit_pilot(
        load_expected(source),
        core_rows,
        site_rows,
        confirmed_lead_id=60,
        confirmed_url="https://fdc.com.br/",
    )
    assert result["core_rows_exact"] == 100
    assert result["untouched_site_rows"] == 99
    assert result["unexpected_site_rows"] == 0
    assert result["writes"] == 0


def test_pilot_audit_reports_only_divergent_ids() -> None:
    expected, core_rows, site_rows = _audit_fixture()
    core_rows[1]["nome"] = "divergente"
    with pytest.raises(M07AuditError, match=r"cadastro_ids=\[2\]"):
        audit_pilot(
            expected,
            core_rows,
            site_rows,
            confirmed_lead_id=60,
            confirmed_url="https://fdc.com.br/",
        )
