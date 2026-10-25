"""Verificações do catálogo e do bloqueio por padrão do M04."""

from __future__ import annotations

import time
from datetime import date
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

from pharmaleads.api.main import create_app
from pharmaleads.domain.source_policy.engine import PolicyEngine, PolicyViolationError
from pharmaleads.domain.source_policy.models import (
    FieldPolicy,
    PolicyAction,
    PolicyDecision,
    Source,
    SourceState,
    SourceType,
)
from pharmaleads.domain.source_policy.registry import (
    CatalogConfiguration,
    CatalogConfigurationError,
)
from pharmaleads.infrastructure.auth.jwt_validator import ALGORITHM, AUDIENCE, ISSUER

SECRET = "m04-test-secret-with-more-than-32-bytes"


def source() -> Source:
    return Source(
        id="synthetic",
        nome="Fonte sintética",
        tipo=SourceType.CSV_MANUAL,
        estado=SourceState.APROVADA,
        descricao="Fixture do M04",
        licenca="interna",
    )


def token(role: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "m04@example.test",
            "aud": AUDIENCE,
            "iss": ISSUER,
            "iat": now,
            "exp": now + 3600,
            "app_metadata": {"role": role},
        },
        SECRET,
        algorithm=ALGORITHM,
    )


def test_policy_engine_denies_by_default_and_allows_explicit_field() -> None:
    policy = FieldPolicy(
        source_id="synthetic",
        campo="nome",
        acao=PolicyAction.EXIBIR,
        decisao=PolicyDecision.PERMITIDO,
        justificativa="campo cadastral",
    )
    engine = PolicyEngine.build([source()], [policy])
    assert engine.allowed("synthetic", "nome", PolicyAction.EXIBIR)
    assert not engine.allowed("synthetic", "email", PolicyAction.EXIBIR)
    with pytest.raises(PolicyViolationError):
        engine.check_or_raise("synthetic", "email", PolicyAction.EXIBIR)


def test_expired_source_blocks_even_with_policy() -> None:
    expired = source().model_copy(update={"vigencia_ate": date(2000, 1, 1)})
    policy = FieldPolicy(
        source_id="synthetic",
        campo="nome",
        acao=PolicyAction.EXIBIR,
        decisao=PolicyDecision.PERMITIDO,
        justificativa="campo cadastral",
    )
    assert not PolicyEngine.build([expired], [policy]).allowed(
        "synthetic", "nome", PolicyAction.EXIBIR
    )


def test_source_endpoints_read_only_configuration(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    monkeypatch.setenv("PHARMALEADS_SUPABASE_JWT_SECRET", SECRET)
    path = tmp_path / "catalog.json"
    approved = source().model_copy(
        update={
            "termos": "Sintéticos",
            "finalidade": "Teste",
            "aprovado_por": "fixture-reviewer",
            "aprovado_em": date(2026, 1, 1),
        }
    )
    configuration = CatalogConfiguration(
        schema_version=1,
        revision="fixture-1",
        sources=(approved,),
        policies=(),
    )
    path.write_text(configuration.model_dump_json(), encoding="utf-8")
    monkeypatch.setenv("PHARMALEADS_SOURCE_POLICY_PATH", str(path))
    original = path.read_bytes()
    with TestClient(create_app()) as client:
        assert client.get("/v1/sources").status_code == 401
        assert (
            client.get(
                "/v1/sources",
                headers={
                    "Authorization": f"Bearer {token('comercial')}",
                },
            ).status_code
            == 403
        )
        admin = {"Authorization": f"Bearer {token('admin')}"}
        operator = {"Authorization": f"Bearer {token('operador')}"}
        listed = client.get("/v1/sources", headers=admin)
        assert listed.status_code == 200 and listed.json()[0]["id"] == "synthetic"
        assert client.get("/v1/sources", headers=operator).status_code == 200
        policies = client.get("/v1/sources/synthetic/policies", headers=operator)
        assert policies.status_code == 200 and policies.json() == []
        assert client.get("/v1/sources/synthetic/history", headers=operator).status_code == 403
        assert client.get("/v1/sources/synthetic/history", headers=admin).json() == []
        assert client.get("/v1/sources/missing/policies", headers=admin).status_code == 404
        assert client.post("/v1/sources", headers=admin, json={}).status_code == 405
        assert (
            client.post(
                "/v1/sources/synthetic/policies",
                headers=admin,
                json={},
            ).status_code
            == 405
        )
        assert (
            client.post(
                "/v1/sources/synthetic/state",
                headers=admin,
                json={
                    "estado": "revogada",
                    "motivo": "Tentativa",
                },
            ).status_code
            == 404
        )
        schema = client.get("/openapi.json").json()
        assert "post" not in schema["paths"]["/v1/sources"]
    assert path.read_bytes() == original


def test_app_rejects_missing_configuration(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PHARMALEADS_SOURCE_POLICY_PATH", str(tmp_path / "missing.json"))
    with pytest.raises(CatalogConfigurationError):
        create_app()
