"""Motor de políticas — avalia permissões por fonte, campo e ação (M04).

Princípio: BLOQUEIO POR PADRÃO (deny by default).
Se nenhuma política explicitamente permitir, a ação é bloqueada.
Revogação ou expiração da fonte bloqueiam qualquer ação.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

from pharmaleads.domain.source_policy.models import (
    FieldPolicy,
    PolicyAction,
    PolicyDecision,
    Source,
)


@dataclass
class PolicyViolation:
    """Detalhe de uma ação bloqueada."""

    source_id: str
    campo: str
    acao: PolicyAction
    motivo: str


@dataclass
class PolicyEngine:
    """Motor de avaliação de políticas de fonte.

    Inicializado com listas de fontes e políticas; imutável após construção.
    """

    _sources: dict[str, Source] = field(default_factory=dict)
    _policies: list[FieldPolicy] = field(default_factory=list)

    @classmethod
    def build(cls, sources: Sequence[Source], policies: Sequence[FieldPolicy]) -> PolicyEngine:
        engine = cls()
        engine._sources = {s.id: s for s in sources}
        engine._policies = sorted(policies, key=lambda p: p.versao, reverse=True)
        return engine

    # ── Consultas ──────────────────────────────────────────────────────────

    def get_source(self, source_id: str) -> Source | None:
        return self._sources.get(source_id)

    def list_sources(self) -> list[Source]:
        return list(self._sources.values())

    def list_policies(self, source_id: str) -> list[FieldPolicy]:
        return [p for p in self._policies if p.source_id == source_id]

    # ── Avaliação ──────────────────────────────────────────────────────────

    def source_active(self, source_id: str) -> bool:
        """True somente se a fonte existe, está aprovada e dentro da vigência."""
        source = self._sources.get(source_id)
        if source is None:
            return False
        return source.is_active()

    def allowed(self, source_id: str, campo: str, acao: PolicyAction) -> bool:
        """Avalia se a ação é permitida. BLOQUEIO POR PADRÃO.

        Critérios em ordem:
        1. Fonte inexistente ou inativa → bloqueado.
        2. Política específica (source_id + campo + acao) válida → usa decisão.
        3. Política curinga (campo='*' + acao) válida → usa decisão.
        4. Sem política → bloqueado.
        """
        if not self.source_active(source_id):
            return False

        # Política específica tem prioridade sobre curinga.
        for wildcard in (False, True):
            lookup = "*" if wildcard else campo
            for policy in self._policies:
                if policy.source_id == source_id and policy.campo == lookup and policy.acao == acao:
                    return policy.is_valid() and policy.decisao == PolicyDecision.PERMITIDO

        return False  # deny by default

    def check_or_raise(self, source_id: str, campo: str, acao: PolicyAction) -> None:
        """Levanta PolicyViolationError se ação não for permitida."""
        if not self.allowed(source_id, campo, acao):
            source = self._sources.get(source_id)
            if source is None:
                motivo = f"Fonte '{source_id}' não cadastrada."
            elif not source.is_active():
                motivo = f"Fonte '{source_id}' inativa (estado: {source.estado})."
            else:
                motivo = f"Ação '{acao}' não permitida para campo '{campo}' da fonte '{source_id}'."
            raise PolicyViolationError(
                PolicyViolation(source_id=source_id, campo=campo, acao=acao, motivo=motivo)
            )


class PolicyViolationError(Exception):
    """Lançada quando uma ação viola a política de fonte."""

    def __init__(self, violation: PolicyViolation) -> None:
        self.violation = violation
        super().__init__(violation.motivo)
