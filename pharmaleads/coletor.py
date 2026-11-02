"""
Coletor: roda o gosom lote a lote e guarda os resultados no banco.

Se o programa parar no meio (queda de internet, Ctrl+C, bloqueio do Google),
basta rodar de novo: os lotes concluídos não são refeitos.
"""
from __future__ import annotations

import random
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import config
from .banco import Banco
from .config import ErroPharmaLeads

NOMES_GOSOM = ["google-maps-scraper", "google-maps-scraper.exe"]


@dataclass
class Opcoes:
    bin: list[str] = field(default_factory=list)  # comando do gosom (lista, ex.: ["./google-maps-scraper"])
    concorrencia: int = 2          # -c
    profundidade: int = 10         # -depth
    idioma: str = "pt-BR"          # -lang
    inatividade: str = "3m"        # -exit-on-inactivity
    emails: bool = False           # -email
    proxies: str = ""              # -proxies
    timeout_min: int = 30          # máximo de minutos por lote
    max_tentativas: int = 3
    espera_erro: int = 30          # segundos (x nº da tentativa)
    pausa_min: float = 20          # pausa entre lotes (segundos)
    pausa_max: float = 60
    limite: int = 0                # máx. de lotes nesta rodada (0 = todos)
    refazer_falhas: bool = False


def localizar_gosom(caminho: str | None = None) -> list[str]:
    """Acha o gosom: o caminho informado, a pasta bin/, a pasta do projeto ou o PATH."""
    if caminho:
        return [caminho]
    for pasta in (config.raiz() / "bin", config.raiz()):
        for nome in NOMES_GOSOM:
            candidato = pasta / nome
            if candidato.is_file():
                return [str(candidato)]
    for nome in NOMES_GOSOM:
        achado = shutil.which(nome)
        if achado:
            return [achado]
    raise ErroPharmaLeads(
        "Não achei o gosom. Baixe o programa em "
        "https://github.com/gosom/google-maps-scraper/releases e coloque o arquivo na pasta 'bin/' "
        "com o nome 'google-maps-scraper' (ou 'google-maps-scraper.exe' no Windows)."
    )


def verificar_gosom(cmd: list[str]) -> list[str]:
    """Confere se o gosom roda e entende as opções que usamos. Devolve as opções que faltam."""
    try:
        r = subprocess.run(cmd + ["-h"], capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        raise ErroPharmaLeads(f"Não consegui executar '{cmd[0]}'. Confira o caminho.")
    except PermissionError:
        raise ErroPharmaLeads(f"Sem permissão para executar '{cmd[0]}'. No Mac/Linux rode: chmod +x {cmd[0]}")
    except subprocess.TimeoutExpired:
        raise ErroPharmaLeads("O gosom demorou demais para responder ao -h.")
    texto = (r.stdout or "") + (r.stderr or "")
    if "-input" not in texto:
        raise ErroPharmaLeads("Esse programa não parece ser o gosom (a ajuda dele não tem a opção -input).")
    esperadas = ["-input", "-results", "-depth", "-lang", "-exit-on-inactivity", "-email", "-proxies"]
    return [o for o in esperadas if o not in texto]


def montar_comando(op: Opcoes, lote: Path, saida: Path) -> list[str]:
    """Monta a linha de comando do gosom. Ajuste aqui se as opções dele mudarem."""
    cmd = op.bin + [
        "-input", str(lote),
        "-results", str(saida),
        "-c", str(op.concorrencia),
        "-depth", str(op.profundidade),
        "-lang", op.idioma,
        "-exit-on-inactivity", op.inatividade,
    ]
    if op.emails:
        cmd.append("-email")
    if op.proxies:
        cmd += ["-proxies", op.proxies]
    return cmd


def rodar_lote(op: Opcoes, lote: Path) -> Path:
    """Executa o gosom para um lote. Levanta RuntimeError se algo der errado."""
    pasta = config.pasta_resultados()
    pasta.mkdir(parents=True, exist_ok=True)
    saida = pasta / f"{lote.stem}.csv"
    if saida.exists():
        saida.unlink()
    try:
        r = subprocess.run(montar_comando(op, lote, saida), capture_output=True, text=True,
                           timeout=op.timeout_min * 60)
    except (FileNotFoundError, PermissionError):
        raise RuntimeError(f"Não consegui executar o gosom ({op.bin[0]}). Confira o caminho e a permissão.")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"O lote passou de {op.timeout_min} minutos e foi interrompido.")
    if r.returncode != 0:
        raise RuntimeError(f"gosom saiu com código {r.returncode}: {(r.stderr or r.stdout)[-300:]}")
    if not saida.exists():
        raise RuntimeError("O gosom terminou, mas não gerou o arquivo de resultados.")
    return saida


def processar(banco: Banco, op: Opcoes, log=print) -> dict:
    """Roda todos os lotes pendentes. Devolve {'concluidos': n, 'falhas': n}."""
    lotes = sorted(config.pasta_consultas().glob("lote_*.txt"))
    if not lotes:
        raise ErroPharmaLeads("Nenhum lote encontrado. Rode antes: python -m pharmaleads gerar")
    banco.verificar()  # Falha antes de iniciar o Gosom se a configuração estiver incorreta.
    if op.refazer_falhas:
        banco.reabrir_falhas()

    feitos = concluidos = falhas = 0
    for arquivo in lotes:
        if op.limite and feitos >= op.limite:
            break
        estado, tentativas = banco.estado_lote(arquivo.name)
        if estado == "concluido":
            continue
        if estado == "falhou" and tentativas >= op.max_tentativas:
            continue  # já desistimos deste; use --refazer-falhas para tentar de novo

        log(f"\n>>> {arquivo.name}")
        ok = False
        while tentativas < op.max_tentativas:
            tentativas += 1
            try:
                csv_saida = banco.resultado_pendente(arquivo.name)
                if csv_saida is None:
                    csv_saida = rodar_lote(op, arquivo)
                    banco.registrar_resultado(arquivo.name, csv_saida)
                log(f"    enviando {csv_saida.name} para o SQLite...")
                novos, existentes = banco.importar_csv(csv_saida)
                banco.marcar_lote(arquivo.name, "concluido", tentativas)
                log(f"    ok: {novos} leads novos, {existentes} repetidos (não duplicam)")
                ok = True
                break
            except RuntimeError as erro:
                banco.marcar_lote(arquivo.name, "falhou", tentativas, str(erro))
                log(f"    tentativa {tentativas}/{op.max_tentativas} falhou: {erro}")
                if tentativas < op.max_tentativas:
                    time.sleep(op.espera_erro * tentativas)
        feitos += 1
        concluidos += ok
        falhas += not ok

        if op.pausa_max > 0:  # pausa aleatória entre lotes, para não parecer um robô
            time.sleep(random.uniform(op.pausa_min, op.pausa_max))

    return {"concluidos": concluidos, "falhas": falhas}
