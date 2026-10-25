"""Consulta autenticada da configuração de fontes. Alterações exigem publicação."""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Request

from pharmaleads.api.dependencies import require_scope
from pharmaleads.domain.source_policy.models import FieldPolicy, Source
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry
from pharmaleads.infrastructure.auth.jwt_validator import AuthenticatedUser

router = APIRouter(prefix="/v1/sources", tags=["sources"])


def _registry(request: Request) -> SourcePolicyRegistry:
    return cast(SourcePolicyRegistry, request.app.state.source_policy_registry)


@router.get("", response_model=list[Source], summary="Fontes da configuração publicada")
async def list_sources(
    request: Request,
    _user: AuthenticatedUser = Depends(require_scope("sources:read")),  # noqa: B008
) -> list[Source]:
    return _registry(request).list_sources()


@router.get("/{source_id}/policies", response_model=list[FieldPolicy])
async def list_policies(
    source_id: str,
    request: Request,
    _user: AuthenticatedUser = Depends(require_scope("sources:read")),  # noqa: B008
) -> list[FieldPolicy]:
    registry = _registry(request)
    if registry.get_source(source_id) is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "SOURCE_NOT_FOUND", "message": "Fonte não encontrada."},
        )
    return registry.list_policies(source_id)


@router.get("/{source_id}/history")
async def history(
    source_id: str,
    request: Request,
    _user: AuthenticatedUser = Depends(require_scope("sources:manage")),  # noqa: B008
) -> list[dict[str, object]]:
    registry = _registry(request)
    if registry.get_source(source_id) is None:
        raise HTTPException(status_code=404, detail="Fonte não encontrada.")
    return registry.history(source_id)
