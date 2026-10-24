"""Dependências FastAPI de autenticação e autorização (M03)."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pharmaleads.config import Settings
from pharmaleads.infrastructure.auth.jwt_validator import (
    AuthenticatedUser,
    TokenError,
    validate_token,
)

_bearer = HTTPBearer(auto_error=False)  # noqa: B008


def _get_settings(request: Request) -> Settings:
    """Recupera Settings injetadas na app (evita instanciar por requisição)."""
    return request.app.state.settings  # type: ignore[no-any-return]


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),  # noqa: B008
    settings: Settings = Depends(_get_settings),  # noqa: B008
) -> AuthenticatedUser:
    """Valida Bearer JWT e retorna o usuário autenticado.

    Retorna 401 em token ausente, inválido ou expirado.
    Nunca vaza detalhes do token no corpo de erro.
    """
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "MISSING_TOKEN", "message": "Autenticação necessária."},
        )

    secret = settings.supabase_jwt_secret
    if secret is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_NOT_CONFIGURED", "message": "Autenticação não configurada."},
        )

    try:
        return validate_token(credentials.credentials, secret.get_secret_value())
    except TokenError as exc:
        code = exc.code
        if code == "TOKEN_EXPIRED":
            raise HTTPException(
                status_code=401,
                detail={"code": "TOKEN_EXPIRED", "message": "Token expirado."},
            ) from None
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_INVALID", "message": "Token inválido."},
        ) from None


def require_scope(scope: str):  # type: ignore[no-untyped-def]  # noqa: ANN201
    """Guard de autorização por escopo de ação.

    Uso: `Depends(require_scope("leads:write"))`.
    Retorna 403 se o papel do usuário não inclui o escopo solicitado.
    """

    async def _check(
        request: Request,
        user: AuthenticatedUser = Depends(get_current_user),  # noqa: B008
    ) -> AuthenticatedUser:
        if scope not in user.scopes:
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN", "message": "Ação não autorizada para este papel."},
            )
        return user

    return _check
