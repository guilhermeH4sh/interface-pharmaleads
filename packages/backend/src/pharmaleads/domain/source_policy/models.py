"""Modelos de domínio — fontes de dados e políticas de uso (M04)."""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


class SourceState(StrEnum):
    """Ciclo de vida de uma fonte."""

    RASCUNHO = "rascunho"
    PENDENTE_APROVACAO = "pendente_aprovacao"
    APROVADA = "aprovada"
    SUSPENSA = "suspensa"
    EXPIRADA = "expirada"
    REVOGADA = "revogada"


# Apenas este estado permite operações de coleta e persistência.
ACTIVE_STATE: SourceState = SourceState.APROVADA


class PolicyAction(StrEnum):
    """Ações avaliadas pelo motor de políticas."""

    COLETAR = "coletar"
    PERSISTIR = "persistir"
    EXIBIR = "exibir"
    EXPORTAR = "exportar"


class PolicyDecision(StrEnum):
    PERMITIDO = "permitido"
    BLOQUEADO = "bloqueado"


class SourceType(StrEnum):
    ARQUIVO_OFICIAL = "arquivo_oficial"
    CSV_MANUAL = "csv_manual"
    SCRAPING_HTTP = "scraping_http"
    SCRAPING_JS = "scraping_js"
    LOCALIZADOR_REDE = "localizador_rede"
    ANVISA = "anvisa"
    FARMACIA_POPULAR = "farmacia_popular"
    GOOGLE_PLACES = "google_places"


class Source(BaseModel):
    """Cadastro de uma fonte de dados."""

    model_config = {"extra": "forbid", "frozen": True, "str_strip_whitespace": True}

    id: str = Field(min_length=1, max_length=64)
    nome: str
    tipo: SourceType
    estado: SourceState
    descricao: str
    licenca: str | None = None
    termos: str | None = None
    fornecedor: str | None = None
    finalidade: str | None = None
    aprovado_por: str | None = None
    aprovado_em: date | None = None
    vigencia_ate: date | None = None

    def is_active(self) -> bool:
        """Fonte só está ativa se aprovada e dentro da vigência."""
        if self.estado != ACTIVE_STATE:
            return False
        if self.vigencia_ate is not None and self.vigencia_ate < date.today():
            return False
        return True


class FieldPolicy(BaseModel):
    """Política para um campo (ou '*') de uma fonte."""

    model_config = {"extra": "forbid", "frozen": True, "str_strip_whitespace": True}

    source_id: str = Field(min_length=1, max_length=64)
    # campo: nome exato da coluna ou "*" para qualquer campo da fonte.
    campo: str = Field(min_length=1, max_length=100)
    acao: PolicyAction
    decisao: PolicyDecision
    justificativa: str = Field(min_length=1, max_length=1000)
    vigente_ate: date | None = None
    versao: int = Field(default=1, ge=1)

    def is_valid(self) -> bool:
        if self.vigente_ate is not None and self.vigente_ate < date.today():
            return False
        return True
