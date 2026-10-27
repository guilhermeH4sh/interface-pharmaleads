"""Tipos e normalização determinística da fila M06."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pharmaleads.shared.identifiers import normalize_cnpj

MAX_PAYLOAD_BYTES = 8_192
KIND_PATTERN = re.compile(r"[a-z][a-z0-9_]{2,31}")


class JobValidationError(ValueError):
    """Entrada de job inválida, sem repetir o payload na mensagem."""


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY_WAIT = "retry_wait"
    CANCELLING = "cancelling"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


ACTIVE_STATES = frozenset(
    {JobState.QUEUED, JobState.RUNNING, JobState.RETRY_WAIT, JobState.CANCELLING}
)
TERMINAL_STATES = frozenset({JobState.SUCCEEDED, JobState.FAILED, JobState.CANCELLED})


def _aware(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise JobValidationError(f"{field_name} deve usar timezone.")
    return value.astimezone(UTC)


def canonical_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    """Valida JSON pequeno e devolve representação estável para idempotência."""
    try:
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        normalized = json.loads(encoded)
    except (TypeError, ValueError, UnicodeError) as exc:
        raise JobValidationError("Payload do job não é JSON válido.") from exc
    if not isinstance(normalized, dict) or len(encoded) > MAX_PAYLOAD_BYTES:
        raise JobValidationError("Payload do job fora do limite permitido.")
    return normalized, encoded


@dataclass(frozen=True)
class JobRequest:
    cnpj: str
    kind: str
    payload: dict[str, Any]
    fingerprint: str

    @classmethod
    def create(cls, cnpj: str, kind: str, payload: dict[str, Any]) -> JobRequest:
        try:
            canonical_cnpj = normalize_cnpj(cnpj)
        except ValueError as exc:
            raise JobValidationError("CNPJ do job inválido.") from exc
        normalized_kind = kind.strip().lower()
        if not KIND_PATTERN.fullmatch(normalized_kind):
            raise JobValidationError("Tipo do job inválido.")
        normalized_payload, encoded = canonical_payload(payload)
        digest = hashlib.sha256()
        digest.update(b"pharmaleads-job-v1\0")
        digest.update(canonical_cnpj.encode("ascii"))
        digest.update(b"\0")
        digest.update(normalized_kind.encode("ascii"))
        digest.update(b"\0")
        digest.update(encoded)
        return cls(canonical_cnpj, normalized_kind, normalized_payload, digest.hexdigest())


@dataclass(frozen=True)
class JobRecord:
    lead_id: int
    cnpj: str
    state: JobState | None = None
    job_id: UUID | None = None
    kind: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    fingerprint: str | None = None
    attempt: int = 0
    fence: int = 0
    worker: str | None = None
    lease_until: datetime | None = None
    available_at: datetime | None = None
    checkpoint: dict[str, Any] = field(default_factory=dict)
    error_code: str | None = None
    requested_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.lead_id < 1 or self.attempt < 0 or self.fence < 0:
            raise JobValidationError("Estado numérico do job inválido.")
        for name in (
            "lease_until",
            "available_at",
            "requested_at",
            "started_at",
            "finished_at",
            "updated_at",
        ):
            value = getattr(self, name)
            if value is not None:
                _aware(value, name)


def new_job_values(request: JobRequest, now: datetime, next_fence: int) -> dict[str, Any]:
    instant = _aware(now, "now")
    return {
        "state": JobState.QUEUED,
        "job_id": uuid4(),
        "kind": request.kind,
        "payload": request.payload,
        "fingerprint": request.fingerprint,
        "attempt": 0,
        "fence": next_fence,
        "worker": None,
        "lease_until": None,
        "available_at": instant,
        "checkpoint": {},
        "error_code": None,
        "requested_at": instant,
        "started_at": None,
        "finished_at": None,
        "updated_at": instant,
    }
