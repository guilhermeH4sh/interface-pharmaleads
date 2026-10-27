"""Executor independente da API; M06 oferece apenas handler sintético identificado."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pharmaleads.domain.jobs.models import JobRecord
from pharmaleads.domain.jobs.queue import JobQueue, QueueConflictError

Handler = Callable[[JobRecord], dict[str, Any]]


def synthetic_probe(job: JobRecord) -> dict[str, Any]:
    """Handler de teste; não acessa rede nem altera campos comerciais."""
    return {"handler": "synthetic_probe", "job_id": str(job.job_id)}


class Worker:
    def __init__(self, worker_id: str, queue: JobQueue, handlers: dict[str, Handler]) -> None:
        self._worker_id = worker_id
        self._queue = queue
        self._handlers = handlers

    def run_once(self, now: datetime | None = None) -> bool:
        instant = now or datetime.now(UTC)
        self._queue.recover_expired(instant)
        job = self._queue.claim(self._worker_id, instant)
        if job is None:
            return False
        handler = self._handlers.get(job.kind or "")
        if handler is None:
            self._queue.fail(job, "handler_not_registered", instant)
            return True
        try:
            checkpoint = handler(job)
        except Exception:
            self._queue.fail(job, "handler_failed", now or datetime.now(UTC))
            return True
        try:
            self._queue.complete(job, checkpoint, now or datetime.now(UTC))
        except QueueConflictError:
            # O resultado não é publicado por um worker que perdeu o fencing token.
            return True
        return True
