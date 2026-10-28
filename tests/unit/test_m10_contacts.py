import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from pharmaleads.domain.contacts.service import (
    SHARED_THRESHOLD,
    checkpoint_records,
    consolidate,
    evidence_records,
    normalize_url,
)
from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate
from pharmaleads.domain.source_policy.engine import PolicyViolationError
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.m10_cli import guarded_persist


def observation(lead_id: int, source: str, evidence: str) -> ObservationCandidate:
    return ObservationCandidate(
        lead_id,
        source,
        ContactKind.EMAIL,
        "Comercial@Exemplo.COM",
        datetime(2026, 10, 28, tzinfo=UTC),
        "https://EXEMPLO.com.br/contato?x=1",
        "m08-http-v1",
        evidence * 64,
    )


def test_consolidation_deduplicates_retries_and_marks_shared_only_at_threshold() -> None:
    contacts = consolidate(
        (
            observation(1, "confirmed_site_http", "a"),
            observation(1, "confirmed_site_http", "a"),
            observation(2, "confirmed_site_browser", "b"),
            observation(3, "confirmed_site_http", "c"),
        )
    )
    assert len(contacts) == 1
    contact = contacts[0]
    assert contact.value == "Comercial@exemplo.com"
    assert contact.lead_ids == (1, 2, 3)
    assert contact.shared is (len(contact.lead_ids) >= SHARED_THRESHOLD)
    assert contact.score_version == "m10-v1"


def test_evidence_url_drops_query_and_normalizes_host() -> None:
    assert normalize_url("https://EXEMPLO.com.br/contato?x=1") == "https://exemplo.com.br/contato"


def test_checkpoint_records_do_not_contain_lead_commercial_fields() -> None:
    record = checkpoint_records((observation(1, "confirmed_site_http", "a"),))[0]
    assert set(record) == {
        "kind",
        "value",
        "shared",
        "score",
        "score_version",
        "sources",
        "evidence_hashes",
    }


def test_evidence_records_do_not_repeat_raw_contact_value() -> None:
    evidence = evidence_records((observation(1, "confirmed_site_http", "a"),))[0]
    assert set(evidence) == {
        "evidence_hash",
        "source_id",
        "source_url",
        "observed_at",
        "extractor_version",
    }
    assert "Comercial@Exemplo.COM" not in evidence.values()


def test_revoked_source_blocks_promotion_before_operation(tmp_path: Path) -> None:
    catalog = json.loads(
        Path("packages/backend/src/pharmaleads/domain/source_policy/catalog.json").read_text(
            encoding="utf-8"
        )
    )
    source = next(item for item in catalog["sources"] if item["id"] == "confirmed_site_http")
    source["estado"] = "revogada"
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog), encoding="utf-8")
    called = False

    def operation() -> None:
        nonlocal called
        called = True

    with pytest.raises(PolicyViolationError):
        guarded_persist(SourcePolicyRegistry(path), ("confirmed_site_http",), operation)
    assert called is False
