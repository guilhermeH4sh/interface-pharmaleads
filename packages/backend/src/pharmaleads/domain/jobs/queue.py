"""Máquina de estados com compare-and-set, lease e fencing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from pharmaleads.domain.jobs.models import (
    ACTIVE_STATES,
    TERMINAL_STATES,
    JobRecord,
    JobRequest,
    JobState,
    JobValidationError,
    new_job_values,
)

DEDUP_WINDOW = timedelta(minutes=15)
DEFAULT_LEASE = timedelta(seconds=60)
MAX_ATTEMPTS = 5


class QueueConflictError(RuntimeError):
    """Outro trabalho ou worker venceu a atualização condicional."""


class QueueNotFoundError(LookupError):
    """Lead ou job inexistente."""


@dataclass(frozen=True)
class ExpectedState:
    state: JobState | None
    fence: int
    worker: str | None = None
    check_worker: bool = False
    lease_must_be_valid: bool = False


class JobBackend(Protocol):
    def by_cnpj(self, cnpj: str) -> JobRecord | None: ...

    def by_id(self, lead_id: int) -> JobRecord | None: ...

    def claimable(self, now: datetime, limit: int) -> list[JobRecord]: ...

    def expired(self, now: datetime, limit: int) -> list[JobRecord]: ...

    def compare_and_set(
        self,
        lead_id: int,
        expected: ExpectedState,
        changes: dict[str, Any],
        now: datetime,
    ) -> JobRecord | None: ...


def _now(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise JobValidationError("Horário da fila deve usar timezone.")
    return value.astimezone(UTC)


class JobQueue:
    def __init__(
        self,
        backend: JobBackend,
        *,
        dedup_window: timedelta = DEDUP_WINDOW,
        lease_duration: timedelta = DEFAULT_LEASE,
        max_attempts: int = MAX_ATTEMPTS,
    ) -> None:
        if dedup_window <= timedelta(0) or lease_duration <= timedelta(0):
            raise ValueError("Janelas da fila devem ser positivas.")
        if not 1 <= max_attempts <= 20:
            raise ValueError("Tentativas da fila fora do limite.")
        self._backend = backend
        self._dedup_window = dedup_window
        self._lease_duration = lease_duration
        self._max_attempts = max_attempts

    def enqueue(self, request: JobRequest, now: datetime) -> tuple[JobRecord, bool]:
        instant = _now(now)
        current = self._backend.by_cnpj(request.cnpj)
        if current is None:
            raise QueueNotFoundError("CNPJ não localizado para enfileiramento.")
        if current.state in ACTIVE_STATES:
            if current.fingerprint == request.fingerprint:
                return current, True
            raise QueueConflictError("Lead já possui trabalho ativo.")
        if (
            current.state in TERMINAL_STATES
            and current.fingerprint == request.fingerprint
            and current.requested_at is not None
            and instant - current.requested_at < self._dedup_window
        ):
            return current, True
        expected = ExpectedState(current.state, current.fence)
        updated = self._backend.compare_and_set(
            current.lead_id,
            expected,
            new_job_values(request, instant, current.fence + 1),
            instant,
        )
        if updated is None:
            raise QueueConflictError("Enfileiramento perdeu a atualização concorrente.")
        return updated, False

    def claim(self, worker: str, now: datetime) -> JobRecord | None:
        instant = _now(now)
        worker_id = self._worker(worker)
        for candidate in self._backend.claimable(instant, 20):
            updated = self._backend.compare_and_set(
                candidate.lead_id,
                ExpectedState(candidate.state, candidate.fence),
                {
                    "state": JobState.RUNNING,
                    "worker": worker_id,
                    "lease_until": instant + self._lease_duration,
                    "attempt": candidate.attempt + 1,
                    "fence": candidate.fence + 1,
                    "started_at": candidate.started_at or instant,
                    "updated_at": instant,
                },
                instant,
            )
            if updated is not None:
                return updated
        return None

    def heartbeat(self, job: JobRecord, now: datetime) -> JobRecord:
        instant = _now(now)
        expected = self._owned(job)
        updated = self._backend.compare_and_set(
            job.lead_id,
            expected,
            {"lease_until": instant + self._lease_duration, "updated_at": instant},
            instant,
        )
        if updated is None:
            raise QueueConflictError("Lease perdido; heartbeat recusado.")
        return updated

    def complete(self, job: JobRecord, checkpoint: dict[str, Any], now: datetime) -> JobRecord:
        instant = _now(now)
        updated = self._backend.compare_and_set(
            job.lead_id,
            self._owned(job),
            {
                "state": JobState.SUCCEEDED,
                "checkpoint": checkpoint,
                "worker": None,
                "lease_until": None,
                "finished_at": instant,
                "updated_at": instant,
            },
            instant,
        )
        if updated is None:
            raise QueueConflictError("Worker obsoleto não pode concluir o job.")
        return updated

    def fail(self, job: JobRecord, error_code: str, now: datetime) -> JobRecord:
        instant = _now(now)
        if not error_code or len(error_code) > 64:
            raise JobValidationError("Código de erro inválido.")
        terminal = job.attempt >= self._max_attempts
        delay = timedelta(seconds=min(300, 2 ** max(0, job.attempt - 1)))
        updated = self._backend.compare_and_set(
            job.lead_id,
            self._owned(job),
            {
                "state": JobState.FAILED if terminal else JobState.RETRY_WAIT,
                "error_code": error_code,
                "worker": None,
                "lease_until": None,
                "available_at": None if terminal else instant + delay,
                "finished_at": instant if terminal else None,
                "updated_at": instant,
            },
            instant,
        )
        if updated is None:
            raise QueueConflictError("Worker obsoleto não pode registrar falha.")
        return updated

    def cancel(self, lead_id: int, now: datetime) -> JobRecord:
        instant = _now(now)
        current = self._backend.by_id(lead_id)
        if current is None or current.state is None:
            raise QueueNotFoundError("Job não localizado para cancelamento.")
        if current.state in TERMINAL_STATES:
            return current
        target = JobState.CANCELLING if current.state == JobState.RUNNING else JobState.CANCELLED
        changes: dict[str, Any] = {"state": target, "updated_at": instant}
        if target == JobState.CANCELLED:
            changes.update({"finished_at": instant, "worker": None, "lease_until": None})
        updated = self._backend.compare_and_set(
            lead_id, ExpectedState(current.state, current.fence), changes, instant
        )
        if updated is None:
            raise QueueConflictError("Cancelamento perdeu a atualização concorrente.")
        return updated

    def recover_expired(self, now: datetime) -> int:
        instant = _now(now)
        recovered = 0
        for current in self._backend.expired(instant, 100):
            cancelled = current.state == JobState.CANCELLING
            changes: dict[str, Any] = {
                "state": JobState.CANCELLED if cancelled else JobState.RETRY_WAIT,
                "worker": None,
                "lease_until": None,
                "available_at": None if cancelled else instant,
                "finished_at": instant if cancelled else None,
                "fence": current.fence + 1,
                "updated_at": instant,
            }
            updated = self._backend.compare_and_set(
                current.lead_id,
                ExpectedState(current.state, current.fence, current.worker, True),
                changes,
                instant,
            )
            recovered += updated is not None
        return recovered

    @staticmethod
    def _worker(value: str) -> str:
        worker = value.strip()
        if not worker or len(worker) > 64 or any(ord(char) < 33 for char in worker):
            raise JobValidationError("Identificador de worker inválido.")
        return worker

    @staticmethod
    def _owned(job: JobRecord) -> ExpectedState:
        if job.state != JobState.RUNNING or job.worker is None or job.lease_until is None:
            raise QueueConflictError("Job não representa lease ativo.")
        return ExpectedState(JobState.RUNNING, job.fence, job.worker, True, True)
