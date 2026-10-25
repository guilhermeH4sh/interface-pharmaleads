"""Catálogo de configuração versionada, somente leitura e sem banco auxiliar."""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from datetime import datetime
from importlib.resources import files
from pathlib import Path
from typing import Literal, Self, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from pharmaleads.domain.source_policy.engine import PolicyEngine
from pharmaleads.domain.source_policy.models import FieldPolicy, PolicyAction, Source, SourceState

T = TypeVar("T")
MAX_CONFIG_BYTES = 2_000_000


class CatalogConfigurationError(RuntimeError):
    """Erro sanitizado: não reproduz caminho, conteúdo ou valores da configuração."""


class ConfigurationChange(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)

    source_id: str = Field(min_length=1)
    revision: str = Field(min_length=1)
    actor: str = Field(min_length=1)
    at: datetime
    reason: str = Field(min_length=1)


class CatalogConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)

    schema_version: Literal[1]
    revision: str = Field(min_length=1)
    sources: tuple[Source, ...]
    policies: tuple[FieldPolicy, ...]
    history: tuple[ConfigurationChange, ...] = ()

    @model_validator(mode="after")
    def check_consistency(self) -> Self:
        ids = {s.id for s in self.sources}
        if len(ids) != len(self.sources):
            raise ValueError("duplicate_source")
        revisions = {(p.source_id, p.campo, p.acao, p.versao) for p in self.policies}
        if len(revisions) != len(self.policies):
            raise ValueError("duplicate_policy_revision")
        if any(p.source_id not in ids for p in self.policies):
            raise ValueError("unknown_policy_source")
        if any(h.source_id not in ids for h in self.history):
            raise ValueError("unknown_history_source")
        for source in self.sources:
            if source.estado == SourceState.APROVADA and not all(
                (
                    source.licenca,
                    source.termos,
                    source.finalidade,
                    source.aprovado_por,
                    source.aprovado_em,
                )
            ):
                raise ValueError("approval_metadata_required")
        return self


def _unique_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


class SourcePolicyRegistry:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path
        # Falha no início em vez de servir políticas incompletas ou usar fallback.
        self.configuration()

    def configuration(self) -> CatalogConfiguration:
        target = (
            self.path
            if self.path is not None
            else files("pharmaleads").joinpath("domain/source_policy/catalog.json")
        )
        try:
            with target.open("rb") as stream:
                raw = stream.read(MAX_CONFIG_BYTES + 1)
            if len(raw) > MAX_CONFIG_BYTES:
                raise ValueError("configuration_too_large")
            document = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_keys)
            return CatalogConfiguration.model_validate(document)
        except (OSError, UnicodeError, ValueError, ValidationError):
            raise CatalogConfigurationError(
                "Configuração de fontes ausente ou inválida; operação bloqueada."
            ) from None

    def snapshot(self) -> PolicyEngine:
        config = self.configuration()
        return PolicyEngine.build(config.sources, config.policies)

    def list_sources(self) -> list[Source]:
        return self.snapshot().list_sources()

    def get_source(self, source_id: str) -> Source | None:
        return self.snapshot().get_source(source_id)

    def list_policies(self, source_id: str) -> list[FieldPolicy]:
        return self.snapshot().list_policies(source_id)

    def history(self, source_id: str) -> list[dict[str, object]]:
        return [
            change.model_dump(mode="json")
            for change in self.configuration().history
            if change.source_id == source_id
        ]

    def guarded(
        self,
        source_id: str,
        fields: Sequence[str],
        action: PolicyAction,
        operation: Callable[[], T],
    ) -> T:
        # Releitura em cada fronteira evita reutilizar uma permissão já revogada.
        engine = self.snapshot()
        if not fields:
            raise ValueError("empty_fields")
        for name in fields:
            engine.check_or_raise(source_id, name, action)
        return operation()
