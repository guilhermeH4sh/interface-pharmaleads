"""Prova remota M06: dois workers, uma execução e limpeza das colunas job_* apenas."""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from time import sleep
from typing import Any
from uuid import UUID

from pharmaleads.domain.jobs.models import JobRecord, JobRequest, JobState
from pharmaleads.domain.jobs.queue import (
    ExpectedState,
    JobBackend,
    JobQueue,
    QueueConflictError,
)
from pharmaleads.infrastructure.job_queue_data_api import DataApiJobBackend, JobDataApiError
from pharmaleads.worker import Worker, synthetic_probe

KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"
TOKEN_ENV = "PHARMALEADS_DATA_API_ACCESS_TOKEN"
APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"


class M06VerificationError(RuntimeError):
    """Falha sanitizada da prova remota."""


class ScopedJobBackend:
    """Restringe a prova a uma única linha, inclusive nas buscas de worker."""

    def __init__(self, backend: JobBackend, lead_id: int) -> None:
        self._backend = backend
        self._lead_id = lead_id

    def by_cnpj(self, cnpj: str) -> JobRecord | None:
        record = self._backend.by_cnpj(cnpj)
        return record if record is not None and record.lead_id == self._lead_id else None

    def by_id(self, lead_id: int) -> JobRecord | None:
        return self._backend.by_id(lead_id) if lead_id == self._lead_id else None

    def claimable(self, now: datetime, limit: int) -> list[JobRecord]:
        current = self._backend.by_id(self._lead_id)
        if (
            limit > 0
            and current is not None
            and current.state in {JobState.QUEUED, JobState.RETRY_WAIT}
            and current.available_at is not None
            and current.available_at <= now
        ):
            return [current]
        return []

    def expired(self, now: datetime, limit: int) -> list[JobRecord]:
        current = self._backend.by_id(self._lead_id)
        if (
            limit > 0
            and current is not None
            and current.state in {JobState.RUNNING, JobState.CANCELLING}
            and current.lease_until is not None
            and current.lease_until <= now
        ):
            return [current]
        return []

    def compare_and_set(
        self,
        lead_id: int,
        expected: ExpectedState,
        changes: dict[str, Any],
        now: datetime,
    ) -> JobRecord | None:
        if lead_id != self._lead_id:
            return None
        return self._backend.compare_and_set(lead_id, expected, changes, now)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Prova concorrente M06 no piloto Supabase.")
    root.add_argument("--lead-id", type=int, default=1)
    root.add_argument("--apply", action="store_true")
    return root


def _cleanup(backend: JobBackend, lead_id: int, job_id: UUID) -> bool:
    current = backend.by_id(lead_id)
    if current is None or current.job_id != job_id or current.state is None:
        return False
    instant = datetime.now(UTC)
    cleared = backend.compare_and_set(
        lead_id,
        ExpectedState(current.state, current.fence),
        {
            "state": None,
            "job_id": None,
            "kind": None,
            "payload": {},
            "fingerprint": None,
            "attempt": 0,
            "fence": current.fence + 1,
            "worker": None,
            "lease_until": None,
            "available_at": None,
            "checkpoint": {},
            "error_code": None,
            "requested_at": None,
            "started_at": None,
            "finished_at": None,
            "updated_at": instant,
        },
        instant,
    )
    return cleared is not None and cleared.state is None and cleared.job_id is None


def _verify_concurrency(backend: JobBackend, lead_id: int) -> dict[str, Any]:
    queue = JobQueue(backend)
    initial = backend.by_id(lead_id)
    if initial is None:
        raise M06VerificationError("Lead de teste não localizado.")
    request = JobRequest.create(
        initial.cnpj,
        "synthetic_probe",
        {"verification": "m06-concurrency-v1"},
    )
    queued, duplicate = queue.enqueue(request, datetime.now(UTC))
    if duplicate or queued.job_id is None:
        raise M06VerificationError("Enfileiramento remoto não foi confirmado.")
    test_job_id = queued.job_id
    cleaned = False
    try:
        barrier = Barrier(2)

        def compete(worker_id: str) -> bool:
            barrier.wait(timeout=10)
            worker = Worker(worker_id, queue, {"synthetic_probe": synthetic_probe})
            return worker.run_once()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(compete, ("m06-worker-a", "m06-worker-b")))
        completed = backend.by_id(lead_id)
        if sum(results) != 1:
            raise M06VerificationError("Disputa remota não produziu exatamente um vencedor.")
        if (
            completed is None
            or completed.job_id != test_job_id
            or completed.state != JobState.SUCCEEDED
            or completed.attempt != 1
            or completed.checkpoint.get("handler") != "synthetic_probe"
        ):
            raise M06VerificationError("Conclusão remota do job não foi confirmada.")
        return {
            "lead_id": lead_id,
            "workers_started": 2,
            "workers_won": 1,
            "attempts": completed.attempt,
            "final_state": completed.state.value,
            "handler": completed.checkpoint["handler"],
        }
    finally:
        cleaned = _cleanup(backend, lead_id, test_job_id)
        if not cleaned and sys.exc_info()[0] is None:
            raise M06VerificationError("Teste passou, mas a limpeza do job não foi confirmada.")


def _verify_recovery(backend: JobBackend, lead_id: int) -> dict[str, Any]:
    initial = backend.by_id(lead_id)
    if initial is None:
        raise M06VerificationError("Lead de teste não localizado.")
    queue = JobQueue(backend, lease_duration=timedelta(seconds=1))
    request = JobRequest.create(
        initial.cnpj,
        "synthetic_probe",
        {"verification": "m06-recovery-v1"},
    )
    queued, duplicate = queue.enqueue(request, datetime.now(UTC))
    if duplicate or queued.job_id is None:
        raise M06VerificationError("Job de recuperação não foi enfileirado.")
    test_job_id = queued.job_id
    try:
        stale = queue.claim("m06-worker-stale", datetime.now(UTC))
        if stale is None:
            raise M06VerificationError("Lease inicial não foi adquirido.")
        sleep(1.2)
        if queue.recover_expired(datetime.now(UTC)) != 1:
            raise M06VerificationError("Lease vencido não foi recuperado.")
        completion_queue = JobQueue(backend, lease_duration=timedelta(seconds=30))
        replacement = completion_queue.claim("m06-worker-recovery", datetime.now(UTC))
        if replacement is None or replacement.fence <= stale.fence:
            raise M06VerificationError("Novo worker não recebeu fencing token superior.")
        stale_rejected = False
        try:
            completion_queue.complete(stale, {"invalid": True}, datetime.now(UTC))
        except QueueConflictError:
            stale_rejected = True
        if not stale_rejected:
            raise M06VerificationError("Worker obsoleto conseguiu concluir o job.")
        completed = completion_queue.complete(
            replacement,
            {"handler": "synthetic_probe", "recovered": True},
            datetime.now(UTC),
        )
        if completed.state != JobState.SUCCEEDED or completed.attempt != 2:
            raise M06VerificationError("Job recuperado não foi concluído corretamente.")
        return {
            "recovery_confirmed": True,
            "stale_worker_fenced": True,
            "recovered_attempts": completed.attempt,
        }
    finally:
        cleaned = _cleanup(backend, lead_id, test_job_id)
        if not cleaned and sys.exc_info()[0] is None:
            raise M06VerificationError("Recuperação passou, mas a limpeza não foi confirmada.")


def verify(backend: JobBackend, lead_id: int) -> dict[str, Any]:
    if lead_id < 1:
        raise M06VerificationError("ID de lead inválido.")
    scoped = ScopedJobBackend(backend, lead_id)
    initial = scoped.by_id(lead_id)
    if initial is None:
        raise M06VerificationError("Lead de teste não localizado.")
    if initial.state is not None or initial.job_id is not None:
        raise M06VerificationError("Lead de teste já possui job; nenhuma alteração enviada.")
    result = _verify_concurrency(scoped, lead_id)
    result.update(_verify_recovery(scoped, lead_id))
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not args.apply:
        print(json.dumps({"mode": "dry-run", "lead_id": args.lead_id, "writes": 0}))
        return 0
    if os.getenv(APPROVAL_ENV) != "public.pharmaleads":
        print("Teste M06 bloqueado: liberação operacional ausente.", file=sys.stderr)
        return 2
    key = os.getenv(KEY_ENV)
    token = os.getenv(TOKEN_ENV)
    if not key or not token:
        print("Teste M06 bloqueado: credenciais de processo ausentes.", file=sys.stderr)
        return 2
    try:
        result = verify(DataApiJobBackend(key, token), args.lead_id)
    except (JobDataApiError, M06VerificationError, QueueConflictError, ValueError) as exc:
        print(f"Teste M06 falhou: {exc}", file=sys.stderr)
        return 1
    result["cleanup_confirmed"] = True
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
