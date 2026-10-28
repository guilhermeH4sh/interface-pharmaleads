import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

import pytest

from pharmaleads.domain.contacts.service import (
    SHARED_THRESHOLD,
    checkpoint_records,
    consolidate,
    contact_id,
    evidence_records,
    normalize_url,
    preserve_reviews,
    review_records,
)
from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate
from pharmaleads.domain.source_policy.engine import PolicyViolationError
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.contact_data_api import ContactDataApiError, ContactRow
from pharmaleads.infrastructure.m10_cli import guarded_persist
from pharmaleads.infrastructure.m10_verify_cli import verify


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
        "id",
        "value",
        "shared",
        "score",
        "score_version",
        "sources",
        "evidence_hashes",
        "review_state",
    }


def test_evidence_records_do_not_repeat_raw_contact_value() -> None:
    evidence = evidence_records((observation(1, "confirmed_site_http", "a"),))[0]
    assert set(evidence) == {
        "evidence_hash",
        "source_id",
        "source_url",
        "observed_at",
        "extractor_version",
        "content_state",
    }
    assert "Comercial@Exemplo.COM" not in evidence.values()
    assert evidence["content_state"] == "minimal_only"


def test_review_is_bound_to_stable_contact_identifier_and_is_preserved() -> None:
    records = checkpoint_records((observation(1, "confirmed_site_http", "a"),))
    identifier = contact_id(ContactKind.EMAIL, "Comercial@Exemplo.COM")
    reviewed = review_records(
        records,
        {identifier},
        "approved",
        "reviewer-1",
        "2026-10-28T00:00:00+00:00",
    )
    assert reviewed[0]["review_state"] == "approved"
    refreshed = checkpoint_records((observation(1, "confirmed_site_http", "a"),))
    assert preserve_reviews(refreshed, reviewed)[0]["reviewed_by"] == "reviewer-1"


def test_review_rejects_unknown_contact_identifier() -> None:
    records = checkpoint_records((observation(1, "confirmed_site_http", "a"),))
    with pytest.raises(ValueError, match="não localizado"):
        review_records(records, {"missing"}, "rejected", "reviewer-1", "now")


class InMemoryContactRepository:
    def __init__(self, row: ContactRow) -> None:
        self._row = row
        self._lock = Lock()

    def get(self, lead_id: int) -> ContactRow | None:
        return self._row if lead_id == self._row.lead_id else None

    def save(
        self,
        row: ContactRow,
        records: tuple[dict[str, object], ...],
        evidence: tuple[dict[str, object], ...],
        *,
        actor: str,
    ) -> ContactRow:
        with self._lock:
            if row.review_version != self._row.review_version:
                raise ContactDataApiError("Gravação de contato perdeu a concorrência.")
            self._row = ContactRow(
                row.lead_id,
                row.cnpj,
                row.checkpoint,
                records,
                evidence,
                row.review_version + 1,
            )
            return self._row


def test_concurrent_review_has_exactly_one_cas_winner() -> None:
    records = checkpoint_records((observation(1, "confirmed_site_http", "a"),))
    identifier = str(records[0]["id"])
    reviewed = review_records(
        records, {identifier}, "approved", "reviewer-1", "2026-10-28T00:00:00+00:00"
    )
    repository = InMemoryContactRepository(ContactRow(1, "123", {}, reviewed, (), 4))
    result = verify(
        repository,
        SourcePolicyRegistry(),
        1,
        identifier,
        "reviewer-1",
    )
    assert result["reviews_won"] == 1
    assert result["final_version"] == 5


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
