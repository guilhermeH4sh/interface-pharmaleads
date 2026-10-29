from typing import Any

import pytest
from fastapi.testclient import TestClient

from pharmaleads.api.dependencies import get_current_user
from pharmaleads.api.main import create_app
from pharmaleads.api.routes.v1 import leads
from pharmaleads.infrastructure.auth.jwt_validator import AuthenticatedUser


def test_crm_pagination_scope_and_injection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    monkeypatch.setenv("PHARMALEADS_DATA_API_PUBLISHABLE_KEY", "sb_publishable_fixture")
    app = create_app()
    uid = "11111111-1111-1111-1111-111111111111"
    user = AuthenticatedUser(uid, "", "comercial", ("leads:read:own",))
    app.dependency_overrides[get_current_user] = lambda: user
    queries: list[dict[str, str]] = []

    def fetch(key: str, token: str, query: dict[str, str]) -> list[dict[str, Any]]:
        assert key == "sb_publishable_fixture" and token == "fixture"
        queries.append(query)
        return [] if query["id"] == "eq.999" else [{"id": 10}, {"id": 11}]

    monkeypatch.setattr(leads, "fetch_rows", fetch)
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer fixture"
        result = client.get("/v1/leads?limit=1&after_id=9&uf=SP&cnpj=12345678000190")
        assert result.status_code == 200
        assert result.json() == {"items": [{"id": 10}], "next_after_id": 10}
        assert queries[-1]["responsavel"] == f"eq.{uid}"
        assert queries[-1]["id"] == "gt.9"
        assert queries[-1]["uf"] == "eq.SP"
        assert client.get("/v1/leads/999").status_code == 404
        assert queries[-1]["responsavel"] == f"eq.{uid}"
        count = len(queries)
        assert client.get("/v1/leads?uf=SP),or(id.gt.0)").status_code == 422
        assert client.get("/v1/leads?limit=101").status_code == 422
        assert len(queries) == count
        user = AuthenticatedUser(uid, "", "operador", ("jobs:manage",))
        assert client.get("/v1/leads").status_code == 403
        assert len(queries) == count


def test_crm_requires_authentication(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    with TestClient(create_app()) as client:
        assert client.get("/v1/leads").status_code == 401
        assert client.get("/v1/leads/1").status_code == 401
