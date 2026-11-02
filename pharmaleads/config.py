"""
Configurações do PharmaLeads: pastas, arquivos e segmentos do setor.

Para mudar o que o projeto busca, edite o dicionário SEGMENTOS abaixo.
"""
from __future__ import annotations

import os
from pathlib import Path


class ErroPharmaLeads(Exception):
    """Erro "esperado" (arquivo faltando, opção inválida...). A CLI mostra só a mensagem."""


# --------------------------------------------------------------------------
# Pastas e arquivos (tudo relativo à pasta do projeto)
# --------------------------------------------------------------------------
def raiz() -> Path:
    """Pasta do projeto. Pode ser trocada pela variável de ambiente PHARMALEADS_HOME."""
    return Path(os.environ.get("PHARMALEADS_HOME") or Path(__file__).resolve().parent.parent)


def pasta_dados() -> Path:
    return raiz() / "dados"


def pasta_consultas() -> Path:
    return pasta_dados() / "consultas"


def pasta_resultados() -> Path:
    return pasta_dados() / "resultados"


def arquivo_locais() -> Path:
    return raiz() / "locais.txt"


# --------------------------------------------------------------------------
# Segmentos do setor farmacêutico
# Cada segmento é um grupo de termos de busca. Você escolhe quais usar no
# comando "gerar" (--segmentos). Sem escolher, usa SEGMENTOS_PADRAO.
# --------------------------------------------------------------------------
SEGMENTOS: dict[str, dict] = {
    "varejo": {
        "descricao": "Farmácias e drogarias de balcão",
        "termos": ["farmácia", "drogaria", "farmácia 24 horas"],
    },
    "manipulacao": {
        "descricao": "Farmácias de manipulação",
        "termos": ["farmácia de manipulação"],
    },
    "homeopatia": {
        "descricao": "Farmácias homeopáticas",
        "termos": ["farmácia homeopática"],
    },
    "veterinaria": {
        "descricao": "Farmácias veterinárias",
        "termos": ["farmácia veterinária"],
    },
    "distribuidoras": {
        "descricao": "Distribuidoras e atacado de medicamentos",
        "termos": ["distribuidora de medicamentos", "distribuidora de produtos farmacêuticos"],
    },
}

SEGMENTOS_PADRAO = ["varejo", "manipulacao"]
