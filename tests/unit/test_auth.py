"""Testes de autenticação e autorização M03.

TC-007: papel em user_metadata não concede permissão — role vem só de app_metadata.
TC-006 (parcial): acesso cruzado a /v1/me retornaria apenas os dados do token apresentado.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient

from pharmaleads.api.main import create_app
from pharmaleads.infrastructure.auth.jwt_validator import (
    ALGORITHM,
    AUDIENCE,
    DEFAULT_ROLE,
    ISSUER,
    TokenError,
    validate_token,
)

# ── Fixtures ───────────────────────────────────────────────────────────────
_SECRET = "super-secret-test-key-nao-usar-em-producao"
_USER_ID = "11111111-1111-1111-1111-111111111111"
_EMAIL = "teste@pharmaleads.local"


def _make_token(
    *,
    secret: str = _SECRET,
    sub: str = _USER_ID,
    email: str = _EMAIL,
    audience: str = AUDIENCE,
    issuer: str = ISSUER,
    exp_offset: int = 3600,
    app_metadata: dict[str, Any] | None = None,
    user_metadata: dict[str, Any] | None = None,
) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "email": email,
        "aud": audience,
        "iss": issuer,
        "iat": now,
        "exp": now + exp_offset,
        "app_metadata": app_metadata or {},
        "user_metadata": user_metadata or {},
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    monkeypatch.setenv("PHARMALEADS_SUPABASE_JWT_SECRET", _SECRET)
    with TestClient(create_app()) as client:
        yield client


# ── validate_token: casos unitários ───────────────────────────────────────

def test_validate_token_admin() -> None:
    token = _make_token(app_metadata={"role": "admin"})
    user = validate_token(token, _SECRET)
    assert user.role == "admin"
    assert "leads:write" in user.scopes
    assert "users:manage" in user.scopes


def test_validate_token_comercial_default() -> None:
    """Sem role em app_metadata → padrão mais restrito (comercial)."""
    token = _make_token(app_metadata={})
    user = validate_token(token, _SECRET)
    assert user.role == DEFAULT_ROLE
    assert "leads:read:own" in user.scopes
    assert "users:manage" not in user.scopes


def test_tc007_user_metadata_role_is_ignored() -> None:
    """TC-007: papel em user_metadata não concede acesso — app_metadata é soberano."""
    token = _make_token(
        user_metadata={"role": "admin"},  # editável pelo usuário → ignorado
        app_metadata={},                  # sem role definido pelo servidor
    )
    user = validate_token(token, _SECRET)
    assert user.role == DEFAULT_ROLE, (
        "role de user_metadata NÃO deve conceder papel elevado"
    )
    assert "users:manage" not in user.scopes


def test_expired_token_raises_error() -> None:
    token = _make_token(exp_offset=-1)  # expirado
    with pytest.raises(TokenError) as exc_info:
        validate_token(token, _SECRET)
    assert exc_info.value.code == "TOKEN_EXPIRED"


def test_wrong_signature_raises_error() -> None:
    token = _make_token(secret="wrong-secret")
    with pytest.raises(TokenError) as exc_info:
        validate_token(token, _SECRET)
    assert exc_info.value.code == "TOKEN_INVALID"


def test_wrong_audience_raises_error() -> None:
    token = _make_token(audience="anon")
    with pytest.raises(TokenError) as exc_info:
        validate_token(token, _SECRET)
    assert exc_info.value.code == "TOKEN_INVALID"


def test_wrong_issuer_raises_error() -> None:
    token = _make_token(issuer="https://outro-projeto.supabase.co/auth/v1")
    with pytest.raises(TokenError) as exc_info:
        validate_token(token, _SECRET)
    assert exc_info.value.code == "TOKEN_INVALID"


def test_empty_secret_raises_error() -> None:
    token = _make_token()
    with pytest.raises(TokenError) as exc_info:
        validate_token(token, "")
    assert exc_info.value.code == "JWT_SECRET_NOT_CONFIGURED"


# ── GET /v1/me via HTTP ────────────────────────────────────────────────────

def test_me_requires_auth(auth_client: TestClient) -> None:
    response = auth_client.get("/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "MISSING_TOKEN"


def test_me_with_expired_token_returns_401(auth_client: TestClient) -> None:
    token = _make_token(exp_offset=-1)
    response = auth_client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_me_with_invalid_signature_returns_401(auth_client: TestClient) -> None:
    token = _make_token(secret="wrong")
    response = auth_client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_me_with_admin_token(auth_client: TestClient) -> None:
    token = _make_token(app_metadata={"role": "admin"})
    response = auth_client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == _USER_ID
    assert body["email"] == _EMAIL
    assert body["role"] == "admin"
    assert "users:manage" in body["scopes"]
    # Token não deve aparecer em nenhum campo da resposta
    assert token not in response.text


def test_me_with_comercial_token(auth_client: TestClient) -> None:
    token = _make_token(app_metadata={"role": "comercial"})
    response = auth_client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "comercial"
    assert "leads:read:own" in body["scopes"]
    assert "users:manage" not in body["scopes"]


def test_me_no_jwt_secret_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Se JWT_SECRET não estiver configurado, retorna 401."""
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    monkeypatch.delenv("PHARMALEADS_SUPABASE_JWT_SECRET", raising=False)
    with TestClient(create_app()) as client:
        token = _make_token()
        response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_NOT_CONFIGURED"


def test_token_content_never_leaked_in_error(auth_client: TestClient) -> None:
    """Detalhes do token não podem vazar no corpo de erros."""
    token = _make_token(secret="wrong", app_metadata={"role": "admin", "secret": "s3cr3t"})
    response = auth_client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "s3cr3t" not in response.text
    assert token not in response.text
