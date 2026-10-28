"""Conexões explícitas e segregadas; nenhuma leitura automática de .env."""

import re
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

from pharmaleads.infrastructure.database.constants import (
    AUTHORIZED_PROJECT_REF,
    AUTHORIZED_SESSION_HOST,
)


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PHARMALEADS_DB_", extra="forbid", hide_input_in_errors=True
    )

    environment: Literal["development", "test"]
    url: SecretStr = Field(repr=False)
    target_host: str
    target_database: str
    connection_mode: Literal["direct", "session"] = "direct"
    project_ref: str | None = None
    sslrootcert: str | None = None
    local_test: bool = False
    pool_size: int = Field(default=2, ge=1, le=5)

    @model_validator(mode="after")
    def validate_target(self) -> "DatabaseSettings":
        try:
            url = make_url(self.url.get_secret_value())
        except Exception:
            raise ValueError("URL PostgreSQL inválida.") from None
        if (
            url.drivername != "postgresql+psycopg"
            or not url.username
            or not url.host
            or url.host != self.target_host
            or url.database != self.target_database
            or (url.port or 5432) != 5432
            or url.query
        ):
            raise ValueError("Destino inválido: use PostgreSQL/psycopg, porta 5432 e sem query.")
        if self.local_test:
            if (
                self.environment != "test"
                or url.host not in {"127.0.0.1", "::1"}
                or self.project_ref is not None
                or self.connection_mode != "direct"
                or not re.fullmatch(r"pharmaleads_test_[a-z0-9_]+", self.target_database)
            ):
                raise ValueError("Exceção local exige banco de teste loopback segregado.")
        else:
            if self.project_ref != AUTHORIZED_PROJECT_REF or self.target_database != "postgres":
                raise ValueError("Projeto/banco Supabase não autorizado para o M02.")
            if not self.sslrootcert:
                raise ValueError("Informe certificado raiz para TLS verify-full.")
            if self.connection_mode == "direct":
                valid_host = url.host == f"db.{self.project_ref}.supabase.co"
            else:
                valid_host = url.host == AUTHORIZED_SESSION_HOST
                valid_host = valid_host and url.username.endswith(f".{self.project_ref}")
            if not valid_host:
                raise ValueError("Host/modo não corresponde ao projeto Supabase informado.")
        return self

    def sqlalchemy_url(self) -> URL:
        return make_url(self.url.get_secret_value())

    def connect_args(self) -> dict[str, str | int]:
        args: dict[str, str | int] = {
            "connect_timeout": 5,
            "application_name": "pharmaleads-m02",
            "options": (
                "-c search_path=pg_catalog -c timezone=UTC "
                "-c statement_timeout=15000 -c lock_timeout=5000"
            ),
            "sslmode": "disable" if self.local_test else "verify-full",
        }
        if not self.local_test and self.sslrootcert:
            args["sslrootcert"] = self.sslrootcert
        return args
