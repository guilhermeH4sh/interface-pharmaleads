"""Persistência M06 por CAS na única tabela Supabase autorizada."""

from __future__ import annotations

import json
import ssl
from datetime import datetime
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

from pharmaleads.domain.jobs.models import JobRecord, JobState
from pharmaleads.domain.jobs.queue import ExpectedState
from pharmaleads.infrastructure.data_api import HOST, validate_publishable_key

TABLE_PATH = "/rest/v1/pharmaleads"
SELECT_FIELDS = ",".join(
    (
        "id",
        "cnpj",
        "job_state",
        "job_id",
        "job_kind",
        "job_payload",
        "job_fingerprint",
        "job_attempt",
        "job_fence",
        "job_worker",
        "job_lease_until",
        "job_available_at",
        "job_checkpoint",
        "job_error_code",
        "job_requested_at",
        "job_started_at",
        "job_finished_at",
        "job_updated_at",
    )
)
DOMAIN_TO_COLUMN = {
    "state": "job_state",
    "job_id": "job_id",
    "kind": "job_kind",
    "payload": "job_payload",
    "fingerprint": "job_fingerprint",
    "attempt": "job_attempt",
    "fence": "job_fence",
    "worker": "job_worker",
    "lease_until": "job_lease_until",
    "available_at": "job_available_at",
    "checkpoint": "job_checkpoint",
    "error_code": "job_error_code",
    "requested_at": "job_requested_at",
    "started_at": "job_started_at",
    "finished_at": "job_finished_at",
    "updated_at": "job_updated_at",
}


class JobDataApiError(RuntimeError):
    """Falha sanitizada do adaptador de fila."""


def _instant(value: object) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise JobDataApiError("Resposta de data inválida.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise JobDataApiError("Resposta de data inválida.") from exc


def _job_state(value: object) -> JobState | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise JobDataApiError("Resposta de estado inválida.")
    try:
        return JobState(value)
    except ValueError as exc:
        raise JobDataApiError("Resposta de estado inválida.") from exc


def _dict(value: object) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise JobDataApiError("Resposta JSON inválida.")
    return value


def _record(row: object) -> JobRecord:
    if not isinstance(row, dict):
        raise JobDataApiError("Resposta de job inválida.")
    try:
        job_id = UUID(str(row["job_id"])) if row.get("job_id") is not None else None
        return JobRecord(
            lead_id=int(row["id"]),
            cnpj=str(row["cnpj"]),
            state=_job_state(row.get("job_state")),
            job_id=job_id,
            kind=str(row["job_kind"]) if row.get("job_kind") is not None else None,
            payload=_dict(row.get("job_payload")),
            fingerprint=(
                str(row["job_fingerprint"]) if row.get("job_fingerprint") is not None else None
            ),
            attempt=int(row.get("job_attempt") or 0),
            fence=int(row.get("job_fence") or 0),
            worker=str(row["job_worker"]) if row.get("job_worker") is not None else None,
            lease_until=_instant(row.get("job_lease_until")),
            available_at=_instant(row.get("job_available_at")),
            checkpoint=_dict(row.get("job_checkpoint")),
            error_code=(
                str(row["job_error_code"]) if row.get("job_error_code") is not None else None
            ),
            requested_at=_instant(row.get("job_requested_at")),
            started_at=_instant(row.get("job_started_at")),
            finished_at=_instant(row.get("job_finished_at")),
            updated_at=_instant(row.get("job_updated_at")),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise JobDataApiError("Resposta de job inválida.") from exc


def _json_value(value: Any) -> Any:
    if isinstance(value, JobState):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


class DataApiJobBackend:
    def __init__(self, publishable_key: str, access_token: str) -> None:
        validate_publishable_key(publishable_key)
        if access_token.count(".") != 2:
            raise ValueError("Token de acesso inválido.")
        self._key = publishable_key
        self._token = access_token

    def _request(
        self, method: str, query: dict[str, str], payload: dict[str, Any] | None = None
    ) -> list[JobRecord]:
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/json",
            "Accept-Profile": "public",
        }
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
            headers.update(
                {
                    "Content-Type": "application/json",
                    "Content-Profile": "public",
                    "Prefer": "return=representation",
                }
            )
        connection = HTTPSConnection(HOST, timeout=10, context=ssl.create_default_context())
        try:
            connection.request(method, f"{TABLE_PATH}?{urlencode(query)}", body, headers)
            response = connection.getresponse()
            data = response.read(262_145)
        finally:
            connection.close()
        if len(data) > 262_144:
            raise JobDataApiError("Resposta da fila acima do limite.")
        if response.status not in {200, 206}:
            raise JobDataApiError(f"Operação da fila recusada (HTTP {response.status}).")
        try:
            rows = json.loads(data)
        except (ValueError, UnicodeError) as exc:
            raise JobDataApiError("Resposta da fila inválida.") from exc
        if not isinstance(rows, list):
            raise JobDataApiError("Resposta da fila inválida.")
        return [_record(row) for row in rows]

    def _one(self, query: dict[str, str]) -> JobRecord | None:
        rows = self._request("GET", {"select": SELECT_FIELDS, "limit": "2", **query})
        if len(rows) > 1:
            raise JobDataApiError("Consulta da fila retornou mais de uma linha.")
        return rows[0] if rows else None

    def by_cnpj(self, cnpj: str) -> JobRecord | None:
        return self._one({"cnpj": f"eq.{cnpj}"})

    def by_id(self, lead_id: int) -> JobRecord | None:
        return self._one({"id": f"eq.{lead_id}"})

    def claimable(self, now: datetime, limit: int) -> list[JobRecord]:
        return self._request(
            "GET",
            {
                "select": SELECT_FIELDS,
                "job_state": "in.(queued,retry_wait)",
                "job_available_at": f"lte.{now.isoformat()}",
                "order": "job_available_at.asc,id.asc",
                "limit": str(limit),
            },
        )

    def expired(self, now: datetime, limit: int) -> list[JobRecord]:
        return self._request(
            "GET",
            {
                "select": SELECT_FIELDS,
                "job_state": "in.(running,cancelling)",
                "job_lease_until": f"lte.{now.isoformat()}",
                "order": "job_lease_until.asc,id.asc",
                "limit": str(limit),
            },
        )

    def compare_and_set(
        self,
        lead_id: int,
        expected: ExpectedState,
        changes: dict[str, Any],
        now: datetime,
    ) -> JobRecord | None:
        query = {
            "select": SELECT_FIELDS,
            "id": f"eq.{lead_id}",
            "job_state": "is.null" if expected.state is None else f"eq.{expected.state.value}",
            "job_fence": f"eq.{expected.fence}",
        }
        if expected.check_worker:
            query["job_worker"] = "is.null" if expected.worker is None else f"eq.{expected.worker}"
        if expected.lease_must_be_valid:
            query["job_lease_until"] = f"gt.{now.isoformat()}"
        payload = {
            DOMAIN_TO_COLUMN[key]: _json_value(value)
            for key, value in changes.items()
            if key in DOMAIN_TO_COLUMN
        }
        rows = self._request("PATCH", query, payload)
        if len(rows) > 1:
            raise JobDataApiError("CAS da fila alterou mais de uma linha.")
        return rows[0] if rows else None
