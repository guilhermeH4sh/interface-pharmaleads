"""
Gerador de consultas.

Combina LOCAIS (cidades/bairros) com os TERMOS de cada SEGMENTO e grava as
buscas em pequenos arquivos (lotes) na pasta dados/consultas/.

Cada linha tem o formato que o gosom entende:
    farmácia em Sorocaba, SP #!#varejo|Sorocaba, SP
O pedaço depois de "#!#" é um rótulo que o gosom devolve no resultado (coluna
input_id). Assim, cada lead guarda de qual segmento e de qual local veio.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from . import config
from .config import ErroPharmaLeads


def ler_locais(caminho: Path) -> list[str]:
    """Lê o arquivo de locais: ignora linhas vazias, comentários (#) e repetidos."""
    if not caminho.exists():
        raise ErroPharmaLeads(f"Não achei {caminho}. Crie o arquivo com um local por linha.")
    locais, vistos = [], set()
    for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip().replace("#!#", "")
        if not linha or linha.startswith("#") or linha.lower() in vistos:
            continue
        vistos.add(linha.lower())
        locais.append(linha)
    if not locais:
        raise ErroPharmaLeads(f"O arquivo {caminho} está vazio.")
    return locais


def validar_segmentos(segmentos: list[str]) -> list[str]:
    invalidos = [s for s in segmentos if s not in config.SEGMENTOS]
    if invalidos:
        raise ErroPharmaLeads(
            f"Segmento(s) desconhecido(s): {', '.join(invalidos)}. "
            f"Disponíveis: {', '.join(config.SEGMENTOS)}."
        )
    return segmentos


def montar_consultas(locais: list[str], segmentos: list[str]) -> list[str]:
    """Cria as linhas de busca. As buscas de um mesmo local ficam juntas."""
    linhas, vistas = [], set()
    for local in locais:
        for segmento in segmentos:
            for termo in config.SEGMENTOS[segmento]["termos"]:
                texto = f"{termo} em {local}"
                if texto.lower() in vistas:
                    continue
                vistas.add(texto.lower())
                linhas.append(f"{texto} #!#{segmento}|{local}")
    return linhas


def gerar_lotes(
    arquivo_locais: Path | None = None,
    segmentos: list[str] | None = None,
    tamanho_lote: int = 20,
    recriar: bool = False,
) -> dict:
    """Gera os lotes. Devolve um resumo: locais, consultas e lotes."""
    locais = ler_locais(arquivo_locais or config.arquivo_locais())
    segmentos = validar_segmentos(segmentos or config.SEGMENTOS_PADRAO)

    pasta = config.pasta_consultas()
    pasta.mkdir(parents=True, exist_ok=True)
    antigos = sorted(pasta.glob("lote_*.txt"))
    if antigos and not recriar:
        raise ErroPharmaLeads(
            f"Já existem {len(antigos)} lotes em '{pasta}'. "
            "Use --recriar para apagá-los e gerar de novo (o histórico de lotes concluídos é mantido)."
        )
    for velho in antigos:
        velho.unlink()

    consultas = montar_consultas(locais, segmentos)
    tam = max(1, tamanho_lote)
    total = 0
    for i in range(0, len(consultas), tam):
        conteudo = "\n".join(consultas[i : i + tam]) + "\n"
        # O trecho do hash no nome muda quando o conteúdo muda, evitando confundir
        # um lote novo com um lote antigo que já foi concluído.
        sufixo = hashlib.md5(conteudo.encode("utf-8")).hexdigest()[:6]
        total += 1
        (pasta / f"lote_{total:04d}_{sufixo}.txt").write_text(conteudo, encoding="utf-8")

    return {"locais": len(locais), "segmentos": segmentos, "consultas": len(consultas), "lotes": total}
