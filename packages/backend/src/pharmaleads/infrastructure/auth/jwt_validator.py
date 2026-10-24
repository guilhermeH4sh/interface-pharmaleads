"""Validação de JWT emitido pelo Supabase Auth (M03).

O Supabase assina JWTs com HS256 usando o JWT_SECRET do projeto.
Papéis internos vêm de `app_metadata.role` — imutável por usuário final.
`user_metadata.role` é editável pelo usuário e portanto ignorado (TC-007).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import jwt

from pharmaleads.infrastructure.database.settings import AUTHORIZED_PROJECT_REF

# ── Constantes do projeto ──────────────────────────────────────────────────
ISSUER = f"https://{AUTHORIZED_PROJECT_REF}.supabase.co/auth/v1"
AUDIENCE = "authenticated"
ALGORITHM = "HS256"

# Papéis reconhecidos (seção 6.1 da spec). Default é o mais restrito.
Role = Literal["admin", "gestor", "comercial", "operador", "revisor", "privacidade"]
ALLOWED_ROLES: frozenset[str] = frozenset(
    {"admin", "gestor", "comercial", "operador", "revisor", "privacidade"}
)
DEFAULT_ROLE: Role = "comercial"

# Escopo de ações por papel — base para guards de rota.
ROLE_SCOPES: dict[str, list[str]] = {
    "admin": [
        "leads:read",
        "leads:write",
        "leads:assign",
        "users:manage",
        "sources:manage",
        "jobs:manage",
        "export:all",
        "privacy:manage",
    ],
    "gestor": ["leads:read", "leads:write", "leads:assign", "export:all"],
    "comercial": ["leads:read:own", "leads:write:own"],
    "operador": ["jobs:manage", "sources:read"],
    "revisor": ["sites:review"],
    "privacidade": ["privacy:manage", "leads:read"],
}


# ── Tipos ──────────────────────────────────────────────────────────────────
class TokenError(Exception):
    """JWT inválido, expirado ou não autorizado."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str   # auth.uid() — UUID string do Supabase
    email: str
    role: Role
    scopes: tuple[str, ...]


# ── Validação ──────────────────────────────────────────────────────────────
def validate_token(token: str, jwt_secret: str) -> AuthenticatedUser:
    """Valida JWT Supabase e extrai usuário com papel interno.

    Raises:
        TokenError: em qualquer falha de validação (signature, exp, aud, iss).
    """
    if not jwt_secret:
        raise TokenError("JWT_SECRET_NOT_CONFIGURED")
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            jwt_secret,
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
            leeway=0,
        )
    except jwt.ExpiredSignatureError:
        raise TokenError("TOKEN_EXPIRED") from None
    except jwt.InvalidTokenError:
        raise TokenError("TOKEN_INVALID") from None

    user_id: str = payload.get("sub", "")
    email: str = payload.get("email", "")

    # Papel vem SOMENTE de app_metadata — não de user_metadata (TC-007).
    app_metadata: dict[str, Any] = payload.get("app_metadata") or {}
    raw_role = app_metadata.get("role", DEFAULT_ROLE)
    role: Role = raw_role if raw_role in ALLOWED_ROLES else DEFAULT_ROLE

    scopes = tuple(ROLE_SCOPES.get(role, []))
    return AuthenticatedUser(user_id=user_id, email=email, role=role, scopes=scopes)
