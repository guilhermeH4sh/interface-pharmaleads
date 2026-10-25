"""Contratos comuns a importadores e coletores; sem executar fontes externas."""

from collections.abc import Callable
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import SourcePolicyRegistry


class AdapterContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    origin: str = Field(min_length=1)
    capabilities: frozenset[PolicyAction]


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source_id: str
    parser_version: str
    origin: str
    values: dict[str, str]


class AdapterBatch(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    cursor: str | None = None
    checkpoint: str | None = None
    observations: tuple[Observation, ...]


class Adapter(Protocol):
    contract: AdapterContract

    def fetch(self, cursor: str | None, checkpoint: str | None) -> AdapterBatch: ...


def collect(
    registry: SourcePolicyRegistry,
    adapter: Adapter,
    fields: tuple[str, ...],
    cursor: str | None = None,
    checkpoint: str | None = None,
) -> AdapterBatch:
    contract = adapter.contract
    if PolicyAction.COLETAR not in contract.capabilities:
        raise ValueError("unsupported_capability")
    batch = registry.guarded(
        contract.source_id, fields, PolicyAction.COLETAR, lambda: adapter.fetch(cursor, checkpoint)
    )
    for observation in batch.observations:
        if (
            observation.source_id != contract.source_id
            or observation.parser_version != contract.version
            or observation.origin != contract.origin
            or not set(observation.values).issubset(fields)
        ):
            raise ValueError("invalid_observation")
    return registry.guarded(contract.source_id, fields, PolicyAction.COLETAR, lambda: batch)


def persist(
    registry: SourcePolicyRegistry,
    batch: AdapterBatch,
    sink: Callable[[AdapterBatch], None],
) -> None:
    # Revalida todas as fontes imediatamente antes do sink, inclusive staging/logs.
    # Lotes são de uma fonte por contrato.
    sources = {o.source_id for o in batch.observations}
    if len(sources) != 1:
        raise ValueError("single_source_required")
    source_id = next(iter(sources))
    fields = tuple({name for o in batch.observations for name in o.values})
    registry.guarded(source_id, fields, PolicyAction.PERSISTIR, lambda: sink(batch))
