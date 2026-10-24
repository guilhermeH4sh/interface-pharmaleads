"""Negativos locais: validação e SQL offline não provam grants num servidor."""

import io
import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr, ValidationError

from pharmaleads.infrastructure.database import cli
from pharmaleads.infrastructure.database.settings import (
    AUTHORIZED_PROJECT_REF,
    AUTHORIZED_SESSION_HOST,
    DatabaseSettings,
)
from pharmaleads.shared.identifiers import normalize_cnpj

ROOT = Path(__file__).resolve().parents[2]


def local_settings(**overrides: object) -> DatabaseSettings:
    values: dict[str, object] = dict(
        environment="test",
        url=SecretStr("postgresql+psycopg://fixture:secret@127.0.0.1:5432/pharmaleads_test_m02"),
        target_host="127.0.0.1",
        target_database="pharmaleads_test_m02",
        local_test=True,
    )
    values.update(overrides)
    return DatabaseSettings.model_validate(values)


@pytest.mark.parametrize(
    "cnpj", ["12ABC34501DE35", "11222333000181", "11222333000262", "04252011000110"]
)
def test_official_dv_and_numeric_compatibility(cnpj: str) -> None:
    assert normalize_cnpj(cnpj) == cnpj


def test_mask_and_lowercase_normalize_without_losing_identity() -> None:
    assert normalize_cnpj("12.abc.345/01de-35") == "12ABC34501DE35"


@pytest.mark.parametrize(
    "cnpj",
    [
        "12ABC34501DE36",
        "00000000000000",
        "12АBC34501DE35",  # Cyrillic А
        "12ABC34501DE3A",
        "11222333000181!",
        "11 222333000181",
    ],
)
def test_invalid_dv_and_noncanonical_input_rejected(cnpj: str) -> None:
    with pytest.raises(ValueError, match="CNPJ inválido"):
        normalize_cnpj(cnpj)


def test_local_exception_does_not_accept_remote_or_general_database() -> None:
    with pytest.raises(ValidationError):
        local_settings(target_database="postgres")
    with pytest.raises(ValidationError):
        local_settings(environment="development")
    with pytest.raises(ValidationError):
        local_settings(target_host="remote.example")
    with pytest.raises(ValidationError):
        local_settings(connection_mode="session")


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://fixture:secret@127.0.0.1/pharmaleads_test_m02",
        "postgresql+psycopg://fixture:secret@127.0.0.1:6543/pharmaleads_test_m02",
        "postgresql+psycopg://fixture:secret@127.0.0.1/pharmaleads_test_m02?sslmode=disable",
    ],
)
def test_driver_port_and_query_cannot_override_safety(url: str) -> None:
    with pytest.raises(ValidationError):
        local_settings(url=SecretStr(url))


def test_tls_and_exact_project_binding() -> None:
    ref = AUTHORIZED_PROJECT_REF
    settings = DatabaseSettings(
        environment="development",
        project_ref=ref,
        url=SecretStr(f"postgresql+psycopg://fixture:secret@db.{ref}.supabase.co/postgres"),
        target_host=f"db.{ref}.supabase.co",
        target_database="postgres",
        sslrootcert="fixture.crt",
    )
    assert settings.connect_args()["sslmode"] == "verify-full"
    assert "secret" not in repr(settings)
    assert settings.connect_args()["connect_timeout"] == 5
    other_ref = "z" * 20
    with pytest.raises(ValidationError):
        DatabaseSettings.model_validate(
            {
                **settings.model_dump(),
                "project_ref": other_ref,
                "target_host": f"db.{other_ref}.supabase.co",
                "url": SecretStr(
                    f"postgresql+psycopg://fixture:secret@db.{other_ref}.supabase.co/postgres"
                ),
            }
        )
    with pytest.raises(ValidationError):
        DatabaseSettings.model_validate(
            {
                **settings.model_dump(),
                "target_database": "other",
                "url": SecretStr(f"postgresql+psycopg://fixture:secret@db.{ref}.supabase.co/other"),
            }
        )
    with pytest.raises(ValidationError):
        DatabaseSettings.model_validate({**settings.model_dump(), "sslrootcert": None})


def test_session_pooler_requires_role_project_suffix() -> None:
    ref = AUTHORIZED_PROJECT_REF
    values = dict(
        environment="development",
        project_ref=ref,
        connection_mode="session",
        target_host=AUTHORIZED_SESSION_HOST,
        target_database="postgres",
        sslrootcert="fixture.crt",
    )
    good = f"postgresql+psycopg://fixture.{ref}:secret@{values['target_host']}/postgres"
    assert DatabaseSettings.model_validate({**values, "url": SecretStr(good)})
    with pytest.raises(ValidationError):
        DatabaseSettings.model_validate({**values, "url": SecretStr(good.replace(f".{ref}:", ":"))})
    with pytest.raises(ValidationError):
        DatabaseSettings.model_validate(
            {
                **values,
                "target_host": "aws-0-sa-east-1.pooler.supabase.com",
                "url": SecretStr(
                    good.replace(AUTHORIZED_SESSION_HOST, "aws-0-sa-east-1.pooler.supabase.com")
                ),
            }
        )


def test_offline_upgrade_and_downgrade_are_scoped() -> None:
    output = io.StringIO()
    cfg = Config(str(ROOT / "database/alembic.ini"), output_buffer=output)
    command.upgrade(cfg, "head", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE core.estabelecimento" in sql
    assert "uq_evento_idempotencia" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "GRANT SELECT ON core.estabelecimento TO phl_runtime" in sql
    assert "Schema preexistente" in sql
    for schema in ("public", "auth", "storage"):
        assert f"DROP TABLE {schema}." not in sql
        assert f"CREATE TABLE {schema}." not in sql
    output.seek(0)
    output.truncate()
    command.downgrade(cfg, "20261023_0001:base", sql=True)
    assert "Rollback recusado" in output.getvalue()
    assert "CASCADE" not in output.getvalue()


def test_settings_do_not_load_local_dotenv(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".env").write_text("PHARMALEADS_DB_POOL_SIZE=999", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert local_settings().pool_size == 2


@pytest.mark.parametrize("action", ["upgrade", "downgrade"])
def test_remote_multischema_migration_is_blocked_before_alembic(
    action: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    ref = AUTHORIZED_PROJECT_REF
    remote = DatabaseSettings(
        environment="development",
        project_ref=ref,
        url=SecretStr(f"postgresql+psycopg://fixture:secret@db.{ref}.supabase.co/postgres"),
        target_host=f"db.{ref}.supabase.co",
        target_database="postgres",
        sslrootcert="fixture.crt",
    )
    calls: list[str] = []
    monkeypatch.chdir(ROOT)
    monkeypatch.setattr(sys, "argv", ["pharmaleads-db", action, "--apply"])
    monkeypatch.setattr(cli, "DatabaseSettings", lambda: remote)
    monkeypatch.setattr(command, action, lambda *args: calls.append(action))

    with pytest.raises(SystemExit) as error:
        cli.main()

    assert error.value.code == 2
    assert calls == []
    assert "multischema bloqueada" in capsys.readouterr().err
