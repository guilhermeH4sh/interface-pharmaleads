"""M04 com configuração somente leitura: nenhum catálogo em banco auxiliar."""

from datetime import date, datetime
from pathlib import Path
from unittest.mock import Mock

import pytest

from pharmaleads.domain.source_policy.adapters import (
    AdapterBatch,
    AdapterContract,
    Observation,
    collect,
    persist,
)
from pharmaleads.domain.source_policy.engine import PolicyViolationError
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
    ConfigurationChange,
    SourcePolicyRegistry,
)
from pharmaleads.infrastructure.data_api_writer import PharmaleadsWriter


def policy(
    action: PolicyAction,
    decision: PolicyDecision = PolicyDecision.PERMITIDO,
    field: str = "nome",
    version: int = 1,
    expired: bool = False,
) -> FieldPolicy:
    return FieldPolicy(
        source_id="fixture",
        campo=field,
        acao=action,
        decisao=decision,
        justificativa="Revisão sintética",
        versao=version,
        vigente_ate=date(2000, 1, 1) if expired else None,
    )


def publish(
    path: Path,
    *policies: FieldPolicy,
    state: SourceState = SourceState.APROVADA,
    revision: str = "fixture-1",
) -> None:
    source = Source(
        id="fixture",
        nome="Fonte sintética",
        tipo=SourceType.CSV_MANUAL,
        estado=state,
        descricao="Teste",
        licenca="sintética",
        termos="Somente fixture",
        finalidade="Teste de M04",
        aprovado_por="fixture-reviewer",
        aprovado_em=date(2026, 1, 1),
    )
    config = CatalogConfiguration(
        schema_version=1,
        revision=revision,
        sources=(source,),
        policies=policies,
        history=(
            ConfigurationChange(
                source_id="fixture",
                revision=revision,
                actor="fixture-reviewer",
                at=datetime.fromisoformat("2026-01-01T00:00:00Z"),
                reason="Configuração sintética",
            ),
        ),
    )
    # Simula publicação atômica de um artefato; produção nunca escreve neste arquivo.
    temporary = path.with_suffix(".next")
    temporary.write_text(config.model_dump_json(), encoding="utf-8")
    temporary.replace(path)


@pytest.fixture
def config_path(tmp_path: Path) -> Path:
    path = tmp_path / "catalog.json"
    publish(path)
    return path


class SyntheticAdapter:
    contract = AdapterContract(
        source_id="fixture",
        version="v1",
        origin="synthetic",
        capabilities=frozenset({PolicyAction.COLETAR}),
    )

    def __init__(self) -> None:
        self.calls = 0

    def fetch(self, cursor: str | None, checkpoint: str | None) -> AdapterBatch:
        self.calls += 1
        return AdapterBatch(
            cursor="next",
            checkpoint="done",
            observations=(
                Observation(
                    source_id="fixture",
                    parser_version="v1",
                    origin="synthetic",
                    values={"nome": "synthetic-only"},
                ),
            ),
        )


def test_default_packaged_config_is_versioned_without_creating_storage(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    registry = SourcePolicyRegistry()
    assert registry.configuration().revision == "m10-contact-consolidation-1"
    assert [source.id for source in registry.list_sources()] == [
        "receita_cnpj",
        "manual_site_candidate",
        "confirmed_site_http",
        "confirmed_site_browser",
    ]
    with pytest.raises(PolicyViolationError):
        registry.guarded("unknown", ("nome",), PolicyAction.COLETAR, Mock())
    assert list(tmp_path.iterdir()) == []


def test_reload_and_restart_read_same_version_without_writes(config_path: Path) -> None:
    publish(config_path, policy(PolicyAction.EXIBIR))
    before = config_path.read_bytes()
    registry = SourcePolicyRegistry(config_path)
    assert registry.snapshot().allowed("fixture", "nome", PolicyAction.EXIBIR)
    assert not registry.snapshot().allowed("fixture", "nome", PolicyAction.EXPORTAR)
    assert SourcePolicyRegistry(config_path).configuration().revision == "fixture-1"
    assert registry.history("fixture")[0]["actor"] == "fixture-reviewer"
    assert config_path.read_bytes() == before
    assert list(config_path.parent.iterdir()) == [config_path]


def test_pending_blocks_before_fetch(config_path: Path) -> None:
    publish(config_path, policy(PolicyAction.COLETAR), state=SourceState.PENDENTE_APROVACAO)
    adapter = SyntheticAdapter()
    with pytest.raises(PolicyViolationError):
        collect(SourcePolicyRegistry(config_path), adapter, ("nome",))
    assert adapter.calls == 0


@pytest.mark.parametrize("expired", [False, True])
def test_latest_revision_never_falls_back(config_path: Path, expired: bool) -> None:
    publish(
        config_path,
        policy(PolicyAction.EXIBIR, field="*"),
        policy(PolicyAction.EXIBIR),
        policy(
            PolicyAction.EXIBIR,
            PolicyDecision.PERMITIDO if expired else PolicyDecision.BLOQUEADO,
            version=2,
            expired=expired,
        ),
    )
    assert (
        not SourcePolicyRegistry(config_path)
        .snapshot()
        .allowed(
            "fixture",
            "nome",
            PolicyAction.EXIBIR,
        )
    )


def test_republished_revocation_blocks_sink_and_existing_registry(
    config_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    policies = (policy(PolicyAction.COLETAR), policy(PolicyAction.PERSISTIR))
    publish(config_path, *policies)
    registry = SourcePolicyRegistry(config_path)
    batch = collect(registry, SyntheticAdapter(), ("nome",))
    publish(config_path, *policies, state=SourceState.REVOGADA, revision="fixture-2")
    sink = Mock()
    with pytest.raises(PolicyViolationError):
        persist(registry, batch, sink)
    sink.assert_not_called()
    assert registry.configuration().revision == "fixture-2"
    assert "synthetic-only" not in config_path.read_text() + caplog.text


def test_allowed_batch_reaches_sink_once(config_path: Path) -> None:
    publish(config_path, policy(PolicyAction.COLETAR), policy(PolicyAction.PERSISTIR))
    registry = SourcePolicyRegistry(config_path)
    adapter = SyntheticAdapter()
    batch = collect(registry, adapter, ("nome",), "cursor", "checkpoint")
    sink = Mock()
    persist(registry, batch, sink)
    sink.assert_called_once_with(batch)
    assert adapter.calls == 1 and batch.checkpoint == "done"


def test_collection_permission_alone_cannot_persist(config_path: Path) -> None:
    publish(config_path, policy(PolicyAction.COLETAR))
    registry = SourcePolicyRegistry(config_path)
    batch = collect(registry, SyntheticAdapter(), ("nome",))
    sink = Mock()
    with pytest.raises(PolicyViolationError):
        persist(registry, batch, sink)
    sink.assert_not_called()


@pytest.mark.parametrize("action", list(PolicyAction))
def test_expired_source_blocks_every_action(config_path: Path, action: PolicyAction) -> None:
    publish(config_path, policy(action), state=SourceState.EXPIRADA)
    assert not SourcePolicyRegistry(config_path).snapshot().allowed("fixture", "nome", action)


def test_writer_revalidates_config_before_each_network_request(
    config_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    publish(config_path, policy(PolicyAction.PERSISTIR))
    registry = SourcePolicyRegistry(config_path)
    writer = PharmaleadsWriter("sb_publishable_fixture", source_id="fixture", registry=registry)
    network = Mock(return_value=(201, b""))
    monkeypatch.setattr(writer, "_request_unchecked", network)
    assert writer._request("POST", "/rest/v1/pharmaleads", [{"nome": "fixture"}])[0] == 201
    publish(
        config_path,
        policy(PolicyAction.PERSISTIR),
        state=SourceState.REVOGADA,
        revision="fixture-2",
    )
    with pytest.raises(PolicyViolationError):
        writer._request("POST", "/rest/v1/pharmaleads", [{"nome": "fixture"}])
    assert network.call_count == 1


def test_missing_override_never_falls_back_or_creates_directory(tmp_path: Path) -> None:
    with pytest.raises(CatalogConfigurationError):
        SourcePolicyRegistry(tmp_path / "missing" / "catalog.json")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "content",
    [
        "invalid secret fixture",
        '{"schema_version":1,"revision":"a","revision":"b","sources":[],"policies":[]}',
        '{"schema_version":2,"revision":"a","sources":[],"policies":[]}',
        '{"schema_version":1,"revision":"a","sources":[],"policies":[],"unexpected":"secret"}',
        "SQLite format 3",
    ],
)
def test_invalid_config_is_sanitized_and_fails_closed(
    config_path: Path,
    content: str,
) -> None:
    registry = SourcePolicyRegistry(config_path)
    config_path.write_text(content, encoding="utf-8")
    effect = Mock()
    with pytest.raises(CatalogConfigurationError) as error:
        registry.guarded("fixture", ("nome",), PolicyAction.PERSISTIR, effect)
    effect.assert_not_called()
    assert "secret" not in str(error.value)
    assert str(config_path) not in str(error.value)


def test_duplicate_policy_revision_is_rejected(config_path: Path) -> None:
    config = SourcePolicyRegistry(config_path).configuration()
    duplicate = policy(PolicyAction.PERSISTIR)
    document = config.model_copy(update={"policies": (duplicate, duplicate)})
    config_path.write_text(document.model_dump_json(), encoding="utf-8")
    with pytest.raises(CatalogConfigurationError):
        SourcePolicyRegistry(config_path)


@pytest.mark.parametrize("problem", ["duplicate_source", "orphan_policy", "missing_approval"])
def test_inconsistent_catalog_cannot_authorize_operations(config_path: Path, problem: str) -> None:
    config = SourcePolicyRegistry(config_path).configuration()
    if problem == "duplicate_source":
        config = config.model_copy(update={"sources": config.sources * 2})
    elif problem == "orphan_policy":
        orphan = policy(PolicyAction.COLETAR).model_copy(update={"source_id": "missing"})
        config = config.model_copy(update={"policies": (orphan,)})
    else:
        source = config.sources[0].model_copy(update={"aprovado_por": None})
        config = config.model_copy(update={"sources": (source,)})
    config_path.write_text(config.model_dump_json(), encoding="utf-8")
    with pytest.raises(CatalogConfigurationError):
        SourcePolicyRegistry(config_path)
