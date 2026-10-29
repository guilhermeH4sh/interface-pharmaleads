"""Consulta CRM paginada, com escopo explícito e RLS do usuário."""

import json
import logging
import ssl
from http.client import HTTPSConnection
from time import perf_counter
from typing import Annotated, Any
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from pharmaleads.api.dependencies import get_current_user
from pharmaleads.infrastructure.auth.jwt_validator import AuthenticatedUser
from pharmaleads.infrastructure.data_api import HOST

router = APIRouter(prefix="/v1/leads", tags=["leads"])
logger = logging.getLogger(__name__)
# Contatos/evidências aguardam filtro de elegibilidade; não selecionar colunas técnicas.
FIELDS = "id,cnpj,nome,razao_social,uf,cidade,responsavel"


def scoped_query(user: AuthenticatedUser) -> dict[str, str]:
    if "leads:read" in user.scopes:
        return {}
    if "leads:read:own" in user.scopes:
        try:
            owner = str(UUID(user.user_id))
        except ValueError:
            raise HTTPException(403, "Perfil inválido.") from None
        return {"responsavel": f"eq.{owner}"}
    raise HTTPException(403, "Consulta CRM não autorizada.")


def fetch_rows(key: str, token: str, query: dict[str, str]) -> list[dict[str, Any]]:
    connection = HTTPSConnection(HOST, timeout=15, context=ssl.create_default_context())
    try:
        connection.request(
            "GET",
            "/rest/v1/pharmaleads?" + urlencode(query),
            headers={
                "apikey": key,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "public",
                "Accept": "application/json",
            },
        )
        response = connection.getresponse()
        raw = response.read(1_048_577)
        if response.status in {401, 403}:
            raise HTTPException(response.status, "Acesso recusado pelo Supabase.")
        if response.status not in {200, 206} or len(raw) > 1_048_576:
            raise HTTPException(502, "Leitura CRM indisponível.")
        rows = json.loads(raw)
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise ValueError
        return rows
    except (OSError, ValueError):
        raise HTTPException(502, "Leitura CRM indisponível.") from None
    finally:
        connection.close()


async def read(request: Request, query: dict[str, str]) -> list[dict[str, Any]]:
    key = request.app.state.settings.data_api_publishable_key
    if key is None:
        raise HTTPException(503, "Supabase não configurado.")
    token = request.headers["authorization"].split(None, 1)[1]
    started = perf_counter()
    try:
        return await run_in_threadpool(fetch_rows, key.get_secret_value(), token, query)
    finally:
        logger.info("event=crm_read duration_ms=%.2f", (perf_counter() - started) * 1000)


@router.get("")
async def list_leads(
    request: Request,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    after_id: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    uf: Annotated[str | None, Query(pattern=r"^[A-Z]{2}$")] = None,
    cnpj: Annotated[str | None, Query(pattern=r"^[A-Z0-9]{14}$")] = None,
) -> dict[str, Any]:
    query = scoped_query(user)
    query.update(select=FIELDS, order="id.asc", id=f"gt.{after_id}", limit=str(limit + 1))
    if uf is not None:
        query["uf"] = f"eq.{uf}"
    if cnpj is not None:
        query["cnpj"] = f"eq.{cnpj}"
    rows = await read(request, query)
    page = rows[:limit]
    return {"items": page, "next_after_id": page[-1]["id"] if len(rows) > limit else None}


@router.get("/{lead_id}")
async def get_lead(
    request: Request,
    lead_id: int,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> dict[str, Any]:
    if lead_id < 1:
        raise HTTPException(422, "ID inválido.")
    query = scoped_query(user)
    query.update(select=FIELDS, id=f"eq.{lead_id}", limit="1")
    rows = await read(request, query)
    if not rows:
        raise HTTPException(404, "Lead não encontrado.")
    return rows[0]
