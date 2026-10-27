"""Persistência CAS do vínculo M07 na única tabela Supabase autorizada."""

from __future__ import annotations

import json
import ssl
from datetime import UTC, datetime
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode

from pharmaleads.domain.sites.linkage import LinkKind
from pharmaleads.domain.sites.models import SiteCandidate, SiteState
from pharmaleads.infrastructure.data_api import HOST, validate_publishable_key

TABLE_PATH = "/rest/v1/pharmaleads"
SELECT_FIELDS = ",".join(
    (
        "id",
        "cnpj",
        "website",
        "site_candidate_url",
        "site_resolved_url",
        "site_source_id",
        "site_state",
        "site_link_kind",
        "site_evidence",
        "site_review_version",
        "site_reviewed_by",
        "site_reviewed_at",
    )
)
AUDIT_CORE_FIELDS = (
    "id",
    "cnpj",
    "nome",
    "razao_social",
    "uf",
    "cidade",
    "bairro",
    "endereco",
    "cnae",
    "telefone",
    "email",
    "origem",
)
AUDIT_SITE_FIELDS = (
    "id",
    "website",
    "site_candidate_url",
    "site_resolved_url",
    "site_source_id",
    "site_state",
    "site_link_kind",
    "site_evidence",
    "site_review_version",
    "site_reviewed_by",
    "site_reviewed_at",
    "site_updated_at",
)


class SiteDataApiError(RuntimeError):
    """Falha sanitizada da persistência de sites."""


def _instant(value: object) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise SiteDataApiError("Resposta de data inválida.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SiteDataApiError("Resposta de data inválida.") from exc


def _required_text(row: dict[str, Any], field: str) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip():
        raise SiteDataApiError("Resposta de site inválida.")
    return value


def _candidate(row: object) -> SiteCandidate | None:
    if not isinstance(row, dict):
        raise SiteDataApiError("Resposta de site inválida.")
    if row.get("site_state") is None:
        return None
    evidence = row.get("site_evidence") or {}
    if not isinstance(evidence, dict) or not all(isinstance(key, str) for key in evidence):
        raise SiteDataApiError("Evidência de site inválida.")
    try:
        return SiteCandidate(
            lead_id=int(row["id"]),
            cnpj=_required_text(row, "cnpj"),
            source_id=_required_text(row, "site_source_id"),
            candidate_url=_required_text(row, "site_candidate_url"),
            final_url=(
                str(row["site_resolved_url"]) if row.get("site_resolved_url") is not None else None
            ),
            state=SiteState(str(row["site_state"])),
            link_kind=(
                LinkKind(str(row["site_link_kind"]))
                if row.get("site_link_kind") is not None
                else None
            ),
            evidence=evidence,
            version=int(row.get("site_review_version") or 0),
            reviewed_by=(
                str(row["site_reviewed_by"]) if row.get("site_reviewed_by") is not None else None
            ),
            reviewed_at=_instant(row.get("site_reviewed_at")),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise SiteDataApiError("Resposta de site inválida.") from exc


class SiteDataApiRepository:
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
        payload: dict[str, Any] | None = None,
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
            raise SiteDataApiError("Resposta de site acima do limite.")
        if response.status not in {200, 206}:
            raise SiteDataApiError(f"Operação de site recusada (HTTP {response.status}).")
        try:
            rows = json.loads(data)
        except (ValueError, UnicodeError) as exc:
            raise SiteDataApiError("Resposta de site inválida.") from exc
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise SiteDataApiError("Resposta de site inválida.")
        return rows

    def get(self, lead_id: int) -> SiteCandidate | None:
        rows = self._request(
            "GET",
            {"select": SELECT_FIELDS, "id": f"eq.{lead_id}", "limit": "2"},
        )
        if len(rows) > 1:
            raise SiteDataApiError("Consulta de site retornou mais de uma linha.")
        return _candidate(rows[0]) if rows else None

    def audit_rows(self, fields: tuple[str, ...]) -> list[dict[str, Any]]:
        if fields not in {AUDIT_CORE_FIELDS, AUDIT_SITE_FIELDS}:
            raise ValueError("Seleção de auditoria inválida.")
        return self._request(
            "GET",
            {
                "select": ",".join(fields),
                "id": "gte.1",
                "and": "(id.lte.100)",
                "order": "id.asc",
                "limit": "101",
            },
        )

    def confirmed_website(self, lead_id: int) -> str:
        rows = self._request(
            "GET",
            {
                "select": "id,website,site_state,site_resolved_url",
                "id": f"eq.{lead_id}",
                "limit": "2",
            },
        )
        if len(rows) != 1:
            raise SiteDataApiError("Site confirmado não localizado.")
        row = rows[0]
        website = row.get("website")
        resolved = row.get("site_resolved_url")
        if (
            row.get("site_state") != SiteState.CONFIRMED.value
            or not isinstance(website, str)
            or website != resolved
        ):
            raise SiteDataApiError("Publicação do site não foi confirmada.")
        return website

    def save(
        self,
        candidate: SiteCandidate,
        *,
        expected_state: SiteState | None,
        expected_version: int,
    ) -> SiteCandidate:
        payload: dict[str, Any] = {
            "site_candidate_url": candidate.candidate_url,
            "site_resolved_url": candidate.final_url,
            "site_source_id": candidate.source_id,
            "site_state": candidate.state.value,
            "site_link_kind": candidate.link_kind.value if candidate.link_kind else None,
            "site_evidence": candidate.evidence,
            "site_review_version": candidate.version,
            "site_reviewed_by": candidate.reviewed_by,
            "site_reviewed_at": (
                candidate.reviewed_at.isoformat() if candidate.reviewed_at else None
            ),
            "site_updated_at": datetime.now(UTC).isoformat(),
        }
        if candidate.state == SiteState.CONFIRMED:
            payload["website"] = candidate.final_url
        rows = self._request(
            "PATCH",
            {
                "select": SELECT_FIELDS,
                "id": f"eq.{candidate.lead_id}",
                "cnpj": f"eq.{candidate.cnpj}",
                "site_state": (
                    "is.null" if expected_state is None else f"eq.{expected_state.value}"
                ),
                "site_review_version": f"eq.{expected_version}",
            },
            payload,
        )
        if len(rows) != 1:
            raise SiteDataApiError("Gravação de site perdeu a concorrência.")
        saved = _candidate(rows[0])
        if saved is None:
            raise SiteDataApiError("Gravação de site não retornou estado.")
        return saved
