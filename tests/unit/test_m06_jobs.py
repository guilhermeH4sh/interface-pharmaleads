"""M06: idempotência, concorrência, lease, fencing e worker sintético."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier, Lock
from typing import Any

import pytest

from pharmaleads.domain.jobs.models import JobRecord, JobRequest, JobState
from pharmaleads.domain.jobs.queue import (
    ExpectedState,
    JobQueue,
    QueueConflictError,
)
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend
from pharmaleads.infrastructure.m06_verify_cli import main as verify_main
from pharmaleads.infrastructure.m06_verify_cli import verify
from pharmaleads.worker import Worker, synthetic_probe

NOW = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
CNPJ = "11222333000181"


class MemoryBackend:
    def __init__(self, *records: JobRecord, claim_barrier: Barrier | None = None) -> None:
        self._records = {record.lead_id: record for record in records}
        self._lock = Lock()
        self._claim_barrier = claim_barrier

    def by_cnpj(self, cnpj: str) -> JobRecord | None:
        with self._lock:
            return next((row for row in self._records.values() if row.cnpj == cnpj), None)

    def by_id(self, lead_id: int) -> JobRecord | None:
        with self._lock:
            return self._records.get(lead_id)

    def claimable(self, now: datetime, limit: int) -> list[JobRecord]:
        with self._lock:
            rows = [
                row
                for row in self._records.values()
                if row.state in {JobState.QUEUED, JobState.RETRY_WAIT}
                and row.available_at is not None
                and row.available_at <= now
            ][:limit]
        if self._claim_barrier is not None:
            self._claim_barrier.wait(timeout=2)
        return rows

    def expired(self, now: datetime, limit: int) -> list[JobRecord]:
        with self._lock:
            return [
                row
                for row in self._records.values()
                if row.state in {JobState.RUNNING, JobState.CANCELLING}
                and row.lease_until is not None
                and row.lease_until <= now
            ][:limit]

    def compare_and_set(
        self,
        lead_id: int,
        expected: ExpectedState,
        changes: dict[str, Any],
        now: datetime,
    ) -> JobRecord | None:
        with self._lock:
            current = self._records.get(lead_id)
            if (
                current is None
                or current.state != expected.state
                or current.fence != expected.fence
            ):
                return None
            if expected.check_worker and current.worker != expected.worker:
                return None
            if expected.lease_must_be_valid and (
                current.lease_until is None or current.lease_until <= now
            ):
                return None
            updated = replace(current, **changes)
            self._records[lead_id] = updated
            return updated


def lead() -> JobRecord:
    return JobRecord(lead_id=1, cnpj=CNPJ)


def request(payload: dict[str, Any] | None = None) -> JobRequest:
    return JobRequest.create(CNPJ, "synthetic_probe", payload or {"page": 1})


def test_fingerprint_normalizes_payload_order() -> None:
    left = JobRequest.create(CNPJ, " SYNTHETIC_PROBE ", {"b": 2, "a": 1})
    right = JobRequest.create(CNPJ, "synthetic_probe", {"a": 1, "b": 2})
    assert left.fingerprint == right.fingerprint
    assert left.payload == {"a": 1, "b": 2}


def test_double_click_deduplicates_but_later_request_is_new() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend)
    first, duplicate = queue.enqueue(request(), NOW)
    same, duplicate_again = queue.enqueue(request(), NOW + timedelta(seconds=1))
    assert duplicate is False
    assert duplicate_again is True
    assert same.job_id == first.job_id

    running = queue.claim("worker-a", NOW + timedelta(seconds=2))
    assert running is not None
    finished = queue.complete(running, {"ok": True}, NOW + timedelta(seconds=3))
    recent, recent_duplicate = queue.enqueue(request(), NOW + timedelta(minutes=10))
    assert recent_duplicate is True
    assert recent.job_id == finished.job_id

    later, later_duplicate = queue.enqueue(request(), NOW + timedelta(minutes=16))
    assert later_duplicate is False
    assert later.job_id != first.job_id


def test_two_workers_cannot_claim_same_job() -> None:
    barrier = Barrier(2)
    backend = MemoryBackend(lead(), claim_barrier=barrier)
    queue = JobQueue(backend)
    queue.enqueue(request(), NOW)
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(
            pool.map(
                lambda worker: queue.claim(worker, NOW + timedelta(seconds=1)),
                ("worker-a", "worker-b"),
            )
        )
    winners = [job for job in claims if job is not None]
    assert len(winners) == 1
    assert winners[0].state == JobState.RUNNING
    assert winners[0].worker in {"worker-a", "worker-b"}


def test_expired_worker_is_fenced_out_after_recovery() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend, lease_duration=timedelta(seconds=10))
    queue.enqueue(request(), NOW)
    stale = queue.claim("worker-old", NOW)
    assert stale is not None
    assert queue.recover_expired(NOW + timedelta(seconds=11)) == 1
    current = queue.claim("worker-new", NOW + timedelta(seconds=11))
    assert current is not None
    assert current.fence > stale.fence
    with pytest.raises(QueueConflictError, match="obsoleto"):
        queue.complete(stale, {"invalid": True}, NOW + timedelta(seconds=12))
    completed = queue.complete(current, {"valid": True}, NOW + timedelta(seconds=12))
    assert completed.checkpoint == {"valid": True}


def test_checkpoint_renews_lease_without_changing_fencing_owner() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend, lease_duration=timedelta(seconds=10))
    queue.enqueue(request(), NOW)
    running = queue.claim("worker-a", NOW)
    assert running is not None
    saved = queue.checkpoint(running, {"pending_urls": ["https://example.com/"]}, NOW)
    assert saved.checkpoint == {"pending_urls": ["https://example.com/"]}
    assert saved.fence == running.fence
    assert saved.worker == running.worker
    assert saved.lease_until == NOW + timedelta(seconds=10)


def test_success_clears_error_from_previous_attempt() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend)
    queue.enqueue(request(), NOW)
    first = queue.claim("worker-a", NOW)
    assert first is not None
    queue.fail(first, "temporary", NOW + timedelta(seconds=1))
    second = queue.claim("worker-b", NOW + timedelta(seconds=2))
    assert second is not None and second.error_code == "temporary"
    completed = queue.complete(second, {"ok": True}, NOW + timedelta(seconds=3))
    assert completed.state == JobState.SUCCEEDED
    assert completed.error_code is None


def test_failure_retries_with_backoff_and_cancel_is_terminal() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend)
    queue.enqueue(request(), NOW)
    running = queue.claim("worker-a", NOW)
    assert running is not None
    retry = queue.fail(running, "temporary", NOW + timedelta(seconds=1))
    assert retry.state == JobState.RETRY_WAIT
    assert queue.claim("worker-b", NOW + timedelta(seconds=1)) is None
    running_again = queue.claim("worker-b", NOW + timedelta(seconds=2))
    assert running_again is not None
    cancelling = queue.cancel(running_again.lead_id, NOW + timedelta(seconds=3))
    assert cancelling.state == JobState.CANCELLING
    assert queue.recover_expired(NOW + timedelta(seconds=63)) == 1
    assert backend.by_id(1).state == JobState.CANCELLED  # type: ignore[union-attr]


def test_worker_runs_only_identified_synthetic_handler() -> None:
    backend = MemoryBackend(lead())
    queue = JobQueue(backend)
    queued, _ = queue.enqueue(request(), NOW)
    worker = Worker("worker-test", queue, {"synthetic_probe": synthetic_probe})
    assert worker.run_once(NOW) is True
    finished = backend.by_id(queued.lead_id)
    assert finished is not None
    assert finished.state == JobState.SUCCEEDED
    assert finished.checkpoint["handler"] == "synthetic_probe"


def test_data_api_cas_sends_fence_worker_and_valid_lease_filters() -> None:
    class RecordingBackend(DataApiJobBackend):
        def __init__(self) -> None:
            self.recorded: tuple[str, dict[str, str], dict[str, Any] | None] | None = None

        def _request(
            self,
            method: str,
            query: dict[str, str],
            payload: dict[str, Any] | None = None,
        ) -> list[JobRecord]:
            self.recorded = (method, query, payload)
            return []

    backend = RecordingBackend()
    result = backend.compare_and_set(
        1,
        ExpectedState(JobState.RUNNING, 7, "worker-a", True, True),
        {"state": JobState.SUCCEEDED, "finished_at": NOW},
        NOW,
    )
    assert result is None
    assert backend.recorded is not None
    method, query, payload = backend.recorded
    assert method == "PATCH"
    assert query["id"] == "eq.1"
    assert query["job_state"] == "eq.running"
    assert query["job_fence"] == "eq.7"
    assert query["job_worker"] == "eq.worker-a"
    assert query["job_lease_until"].startswith("gt.")
    assert payload == {"job_state": "succeeded", "job_finished_at": NOW.isoformat()}


def test_m06_sql_is_restricted_to_columns_on_pharmaleads() -> None:
    sql = (Path(__file__).parents[2] / "ops" / "sql" / "m06-add-job-columns.sql").read_text(
        encoding="utf-8"
    )
    normalized = " ".join(sql.lower().split())
    assert "alter table public.pharmaleads" in normalized
    assert "create table" not in normalized
    assert "create function" not in normalized
    assert "create trigger" not in normalized
    assert "create index" not in normalized
    assert " service_role" not in normalized
    assert " cascade" not in normalized


def test_remote_verification_flow_has_one_winner_and_cleans_job() -> None:
    backend = MemoryBackend(lead())
    result = verify(backend, 1)
    assert result["workers_started"] == 2
    assert result["workers_won"] == 1
    assert result["final_state"] == "succeeded"
    assert result["recovery_confirmed"] is True
    assert result["stale_worker_fenced"] is True
    assert result["recovered_attempts"] == 2
    cleaned = backend.by_id(1)
    assert cleaned is not None
    assert cleaned.state is None
    assert cleaned.job_id is None
    assert cleaned.fence > 0


def test_worker_uses_current_time_when_publishing_handler_result() -> None:
    from time import sleep

    backend = MemoryBackend(lead())
    queue = JobQueue(backend, lease_duration=timedelta(milliseconds=5))
    queue.enqueue(request(), datetime.now(UTC))

    def slow_handler(_job: JobRecord) -> dict[str, Any]:
        sleep(0.02)
        return {"must_not_publish": True}

    assert Worker("slow-worker", queue, {"synthetic_probe": slow_handler}).run_once()
    current = backend.by_id(1)
    assert current is not None
    assert current.state == JobState.RUNNING
    assert current.checkpoint == {}


def test_remote_verification_defaults_to_dry_run(capsys: pytest.CaptureFixture[str]) -> None:
    assert verify_main(["--lead-id", "1"]) == 0
    assert json.loads(capsys.readouterr().out) == {"mode": "dry-run", "lead_id": 1, "writes": 0}
