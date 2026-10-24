"""Rota GET /v1/me — perfil e papéis do usuário autenticado (M03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from pharmaleads.api.dependencies import get_current_user
from pharmaleads.infrastructure.auth.jwt_validator import AuthenticatedUser

router = APIRouter(prefix="/v1", tags=["identity"])


class MeResponse(BaseModel):
    """Perfil retornado ao usuário autenticado."""

    id: str
    email: str
    role: str
    scopes: list[str]


@router.get("/me", response_model=MeResponse, summary="Perfil do usuário autenticado")
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> MeResponse:  # noqa: B008
    """Retorna o identificador, e-mail, papel e escopos do token atual.

    Requer Bearer JWT válido. Não expõe dados de outros usuários (IDOR).
    """
    return MeResponse(
        id=user.user_id,
        email=user.email,
        role=user.role,
        scopes=list(user.scopes),
    )
