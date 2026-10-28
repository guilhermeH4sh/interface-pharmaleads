"""Persistência CAS M10 na única tabela Supabase autorizada."""

from __future__ import annotations

import json
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode

from pharmaleads.infrastructure.data_api import HOST, validate_publishable_key

TABLE_PATH = "/rest/v1/pharmaleads"
SELECT_FIELDS = ",".join(("id", "cnpj", "job_checkpoint", "contact_review_version"))


class ContactDataApiError(RuntimeError):
    """Falha sanitizada da promoção M10."""


@dataclass(frozen=True)
class ContactRow:
    lead_id: int
    cnpj: str
    checkpoint: dict[str, object]
    review_version: int


def _row(value: object) -> ContactRow:
    if not isinstance(value, dict):
        raise ContactDataApiError("Resposta de contato inválida.")
    checkpoint = value.get("job_checkpoint") or {}
    if not isinstance(checkpoint, dict):
        raise ContactDataApiError("Checkpoint de contato inválido.")
    try:
        lead_id = int(value["id"])
        cnpj = str(value["cnpj"])
        version = int(value.get("contact_review_version") or 0)
    except (KeyError, TypeError, ValueError) as exc:
        raise ContactDataApiError("Resposta de contato inválida.") from exc
    if lead_id < 1 or not cnpj or version < 0:
        raise ContactDataApiError("Resposta de contato inválida.")
    return ContactRow(lead_id, cnpj, checkpoint, version)


class ContactDataApiRepository:
    def __init__(self, publishable_key: str, access_token: str) -> None:
        validate_publishable_key(publishable_key)
        if access_token.count(".") != 2:
            raise ValueError("Token de acesso inválido.")
        self._key = publishable_key
        self._token = access_token

    def _request(
        self,
        method: str,
        query: dict[str, str],
        payload: dict[str, object] | None = None,
    ) -> list[dict[str, Any]]:
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
            raise ContactDataApiError("Resposta de contato acima do limite.")
        if response.status not in {200, 206}:
            raise ContactDataApiError(f"Operação de contato recusada (HTTP {response.status}).")
        try:
            rows = json.loads(data)
        except (ValueError, UnicodeError) as exc:
            raise ContactDataApiError("Resposta de contato inválida.") from exc
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise ContactDataApiError("Resposta de contato inválida.")
        return rows

    def get(self, lead_id: int) -> ContactRow | None:
        rows = self._request(
            "GET", {"select": SELECT_FIELDS, "id": f"eq.{lead_id}", "limit": "2"}
        )
        if len(rows) > 1:
            raise ContactDataApiError("Consulta de contato retornou mais de uma linha.")
        return _row(rows[0]) if rows else None

    def save(
        self,
        row: ContactRow,
        records: tuple[dict[str, object], ...],
        evidence: tuple[dict[str, str], ...],
        *,
        actor: str,
    ) -> ContactRow:
        now = datetime.now(UTC).isoformat()
        payload: dict[str, object] = {
            "contact_records": list(records),
            "contact_evidence": list(evidence),
            "contact_review_version": row.review_version + 1,
            "contact_reviewed_by": actor,
            "contact_reviewed_at": now,
            "contact_updated_at": now,
        }
        rows = self._request(
            "PATCH",
            {
                "select": SELECT_FIELDS,
                "id": f"eq.{row.lead_id}",
                "cnpj": f"eq.{row.cnpj}",
                "contact_review_version": f"eq.{row.review_version}",
            },
            payload,
        )
        if len(rows) != 1:
            raise ContactDataApiError("Gravação de contato perdeu a concorrência.")
        return _row(rows[0])
