"""O probe de conexão não pode ler linhas nem atingir outra tabela."""

import ssl
from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from pharmaleads.api.main import create_app
from pharmaleads.infrastructure import data_api


def test_probe_is_head_only_for_authorized_table(monkeypatch: pytest.MonkeyPatch) -> None:
    connection = MagicMock()
    connection.getresponse.return_value.status = 200
    constructor = MagicMock(return_value=connection)
    monkeypatch.setattr(data_api, "HTTPSConnection", constructor)

    assert data_api.probe("sb_publishable_fixture") == 200
    constructor.assert_called_once()
    args, kwargs = constructor.call_args
    assert args == ("qxsdcrywsjkrpcbfgbxb.supabase.co",)
    assert kwargs["timeout"] == 10
    assert isinstance(kwargs["context"], ssl.SSLContext)
    assert kwargs["context"].check_hostname
    assert kwargs["context"].verify_mode == ssl.CERT_REQUIRED
    connection.request.assert_called_once_with(
        "HEAD",
        "/rest/v1/pharmaleads?select=id&limit=0",
        headers={
            "apikey": "sb_publishable_fixture",
            "Accept-Profile": "public",
            "Accept": "application/json",
        },
    )
    connection.close.assert_called_once()


@pytest.mark.parametrize("key", ["", "sb_secret_fixture", "sb_publishable_bad key"])
def test_probe_rejects_wrong_key_before_network(key: str, monkeypatch: pytest.MonkeyPatch) -> None:
    constructor = MagicMock()
    monkeypatch.setattr(data_api, "HTTPSConnection", constructor)
    with pytest.raises(ValueError):
        data_api.probe(key)
    constructor.assert_not_called()


def test_failure_output_omits_key(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(data_api.KEY_ENV, "sb_publishable_fixture")
    monkeypatch.setattr(data_api, "probe", lambda key: 401)
    assert data_api.main() == 1
    assert "sb_publishable_fixture" not in capsys.readouterr().out


@pytest.fixture
def connected_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv(data_api.KEY_ENV, "sb_publishable_fixture")
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    with TestClient(create_app()) as client:
        yield client


def test_api_health_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(data_api.KEY_ENV, raising=False)
    monkeypatch.setenv("PHARMALEADS_APP_ENV", "test")
    with TestClient(create_app()) as client:
        response = client.get("/health/supabase")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SUPABASE_NOT_CONFIGURED"


def test_api_health_uses_only_head_and_returns_no_rows(
    connected_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    called_with: list[str] = []

    def fake_probe(key: str) -> int:
        called_with.append(key)
        return 200

    monkeypatch.setattr(data_api, "probe", fake_probe)
    response = connected_client.get("/health/supabase")
    assert response.status_code == 200
    assert response.json() == {
        "status": "connected",
        "table": "public.pharmaleads",
        "method": "HEAD",
        "rows_returned": 0,
    }
    assert called_with == ["sb_publishable_fixture"]
    assert connected_client.get("/ready").status_code == 503


@pytest.mark.parametrize("status", [401, 403, 500])
def test_api_health_fails_closed_on_upstream_status(
    connected_client: TestClient, monkeypatch: pytest.MonkeyPatch, status: int
) -> None:
    monkeypatch.setattr(data_api, "probe", lambda key: status)
    response = connected_client.get("/health/supabase")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SUPABASE_UNAVAILABLE"
    assert "sb_publishable_fixture" not in response.text


def test_api_health_fails_closed_on_connection_error(
    connected_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def failed_probe(key: str) -> int:
        raise OSError("sb_publishable_fixture")

    monkeypatch.setattr(data_api, "probe", failed_probe)
    response = connected_client.get("/health/supabase")
    assert response.status_code == 503
    assert "sb_publishable_fixture" not in response.text
