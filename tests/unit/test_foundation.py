from collections.abc import Iterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from pharmaleads.api.main import create_app
from pharmaleads.config import Settings


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield client


def test_health_is_not_readiness(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "alive", "module": "M01"}
    ready = client.get("/ready")
    assert ready.status_code == 503
    assert ready.json()["error"]["code"] == "DEPENDENCIES_NOT_IMPLEMENTED"
    assert ready.headers["cache-control"] == "no-store"


def test_request_id_on_success_and_error(client: TestClient) -> None:
    request_id = str(uuid4())
    for path, status in [("/health", 200), ("/ready", 503), ("/missing", 404)]:
        response = client.get(path, headers={"X-Request-ID": request_id})
        assert response.status_code == status
        assert response.headers["X-Request-ID"] == request_id
        if status != 200:
            assert response.json()["error"]["request_id"] == request_id


@pytest.mark.parametrize("value", ["invalid", "x" * 500, "-" * 36])
def test_untrusted_correlation_is_replaced(client: TestClient, value: str) -> None:
    response = client.get("/health", headers={"X-Request-ID": value})
    assert str(UUID(response.headers["X-Request-ID"])) != value


def test_errors_do_not_leak_input_or_exception(
    app: FastAPI, client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    # Rotas de teste isoladas, nunca instaladas na aplicação operacional.
    @app.get("/test-error")
    def crash() -> None:
        raise RuntimeError("fixture-sensitive-value")

    @app.get("/test-validation")
    def validation(value: int) -> int:
        return value

    response = client.get("/test-error")
    assert response.status_code == 500
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
    assert "fixture-sensitive-value" not in response.text + caplog.text
    invalid = client.get("/test-validation", params={"value": "fixture-sensitive-value"})
    assert invalid.status_code == 422
    assert "fixture-sensitive-value" not in invalid.text
    method = client.post("/health")
    assert method.status_code == 405
    assert method.headers["allow"] == "GET"


def test_cors_is_explicit(client: TestClient) -> None:
    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.get("/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_config_fails_without_echoing_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHARMALEADS_APP_PORT", "fixture-sensitive-value")
    with pytest.raises(RuntimeError, match="Configuração inválida: app_port") as error:
        create_app()
    assert "fixture-sensitive-value" not in str(error.value)


def test_legacy_dotenv_is_not_loaded(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".env").write_text("PHARMALEADS_APP_PORT=invalid", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("PHARMALEADS_APP_PORT", raising=False)
    assert Settings().app_port == 8000


def test_invalid_json_config_is_sanitized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHARMALEADS_ALLOWED_ORIGINS", "fixture-sensitive-value")
    with pytest.raises(RuntimeError, match="Configuração inválida") as error:
        create_app()
    assert "fixture-sensitive-value" not in str(error.value)


@pytest.mark.parametrize(
    "origin", ["*", "https://user:pass@example.test", "file:///tmp", "https://example.test/path"]
)
def test_reject_unsafe_cors(origin: str) -> None:
    with pytest.raises(ValidationError):
        Settings(allowed_origins=[origin])
