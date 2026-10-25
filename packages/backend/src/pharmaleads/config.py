"""Configuração local explícita; nunca carrega o .env do projeto legado."""

from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PHARMALEADS_", extra="forbid", hide_input_in_errors=True
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_host: Literal["127.0.0.1", "localhost", "::1", "0.0.0.0"] = "127.0.0.1"
    app_port: int = Field(default=8000, ge=1024, le=65535)
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    data_api_publishable_key: SecretStr | None = None
    # JWT_SECRET do projeto Supabase (Settings → API → JWT Settings).
    # Não versionar; manter em variável de processo.
    supabase_jwt_secret: SecretStr | None = None
    # None carrega o JSON versionado incluído no pacote; override também é somente leitura.
    source_policy_path: Path | None = None

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
            ):
                raise ValueError("Use origens HTTP(S) explícitas, sem caminho ou credenciais.")
            # Faz a validação de porta do parser, inclusive valores fora do intervalo.
            _ = parsed.port
        return origins
