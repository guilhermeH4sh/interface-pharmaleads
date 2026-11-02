"""
Linha de comando do PharmaLeads.

    python -m pharmaleads segmentos
    python -m pharmaleads gerar
    python -m pharmaleads verificar
    python -m pharmaleads coletar --limite 1
    python -m pharmaleads status
    python -m pharmaleads exportar leads.csv --ativas --com-celular
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__, config, gerador
from .banco import Banco
from .coletor import Opcoes, localizar_gosom, processar, verificar_gosom
from .config import ErroPharmaLeads


def _cmd_importar(args):
    banco = Banco()
    try:
        banco.verificar()
        novos, existentes = banco.importar_csv(Path(args.arquivo))
        print(f'Importado para SQLite: {novos} novos, {existentes} atualizados/repetidos.')
    finally:
        banco.fechar()


def _cmd_segmentos(args) -> None:
    for nome, info in config.SEGMENTOS.items():
        padrao = " (padrão)" if nome in config.SEGMENTOS_PADRAO else ""
        print(f"{nome}{padrao}: {info['descricao']}")
        print(f"    termos: {', '.join(info['termos'])}")


def _cmd_gerar(args) -> None:
    r = gerador.gerar_lotes(
        arquivo_locais=Path(args.locais) if args.locais else None,
        segmentos=args.segmentos,
        tamanho_lote=args.tamanho_lote,
        recriar=args.recriar,
    )
    print(f"{r['locais']} locais x segmentos [{', '.join(r['segmentos'])}] = {r['consultas']} buscas")
    print(f"{r['lotes']} lotes gravados em '{config.pasta_consultas()}'")


def _cmd_verificar(args) -> None:
    cmd = localizar_gosom(args.bin)
    faltando = verificar_gosom(cmd)
    print(f"gosom encontrado: {' '.join(cmd)}")
    if faltando:
        print("ATENÇÃO: esta versão não mostra estas opções na ajuda: " + ", ".join(faltando))
        print("Se algo falhar, ajuste a função montar_comando() em pharmaleads/coletor.py.")
    else:
        print("Tudo certo: o gosom entende todas as opções usadas pelo PharmaLeads.")


def _cmd_coletar(args) -> None:
    op = Opcoes(
        bin=localizar_gosom(args.bin),
        concorrencia=args.concorrencia,
        profundidade=args.profundidade,
        idioma=args.idioma,
        inatividade=args.inatividade,
        emails=args.emails,
        proxies=args.proxies,
        timeout_min=args.timeout,
        max_tentativas=args.max_tentativas,
        espera_erro=args.espera_erro,
        pausa_min=args.pausa_min,
        pausa_max=args.pausa_max,
        limite=args.limite,
        refazer_falhas=args.refazer_falhas,
    )
    banco = Banco()
    try:
        r = processar(banco, op)
        print(f"\nFim da rodada: {r['concluidos']} lotes concluídos, {r['falhas']} com falha.")
        _imprimir_resumo(banco)
    finally:
        banco.fechar()


def _imprimir_resumo(banco: Banco) -> None:
    r = banco.resumo()
    total_lotes = len(list(config.pasta_consultas().glob("lote_*.txt")))
    print(f"Lotes gerados: {total_lotes}")
    for estado, qtd in r["lotes"].items():
        print(f"  {estado}: {qtd}")
    print(f"Leads únicos no SQLite: {r['total']}")
    for titulo, chave in (("Situação", "situacao"), ("Segmento", "segmento")):
        if r[chave]:
            print(f"  {titulo}: " + ", ".join(f"{k}={v}" for k, v in r[chave].items()))
    print(f"  Com telefone: {r['com_telefone']} (celular/WhatsApp provável: {r['com_celular']})")
    print(f"  Com site: {r['com_site']} | Com e-mail: {r['com_email']}")


def _cmd_status(args) -> None:
    banco = Banco()
    try:
        _imprimir_resumo(banco)
    finally:
        banco.fechar()


def _cmd_sincronizar(args) -> None:
    banco = Banco()
    try:
        pendentes = banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0]
        enviados = banco.sincronizar_pendentes(obrigatorio=True)
        restantes = banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0]
        print(f'Supabase: {enviados} leads enviados; {restantes} pendentes de {pendentes}.')
    finally:
        banco.fechar()


def _cmd_exportar(args) -> None:
    banco = Banco()
    try:
        n = banco.exportar(
            args.arquivo,
            ativas=args.ativas,
            com_email=args.com_email,
            com_telefone=args.com_telefone,
            com_celular=args.com_celular,
            segmento=args.segmento,
        )
        print(f"{n} leads exportados para {args.arquivo}")
    finally:
        banco.fechar()


def _montar_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="pharmaleads", description="PharmaLeads: leads do setor farmacêutico.")
    ap.add_argument("--versao", action="version", version=f"PharmaLeads {__version__}")
    sub = ap.add_subparsers(dest="comando", required=True)

    i = sub.add_parser('importar', help='envia um CSV já coletado pelo Gosom ao Supabase')
    i.add_argument('arquivo', help='caminho do CSV do Gosom')
    i.set_defaults(func=_cmd_importar)

    sub.add_parser("segmentos", help="lista os segmentos de busca disponíveis").set_defaults(func=_cmd_segmentos)

    g = sub.add_parser("gerar", help="gera os lotes de buscas a partir do locais.txt")
    g.add_argument("--locais", help="arquivo com um local por linha (padrão: locais.txt)")
    g.add_argument("--segmentos", nargs="+", help=f"segmentos a buscar (padrão: {' '.join(config.SEGMENTOS_PADRAO)})")
    g.add_argument("--tamanho-lote", type=int, default=20, help="buscas por lote (padrão 20)")
    g.add_argument("--recriar", action="store_true", help="apaga os lotes antigos e gera de novo")
    g.set_defaults(func=_cmd_gerar)

    v = sub.add_parser("verificar", help="confere se o gosom está instalado e compatível")
    v.add_argument("--bin", help="caminho do gosom (padrão: procura em bin/)")
    v.set_defaults(func=_cmd_verificar)

    c = sub.add_parser("coletar", help="roda o gosom lote a lote e guarda os leads")
    c.add_argument("--bin", help="caminho do gosom (padrão: procura em bin/)")
    c.add_argument("--limite", type=int, default=0, help="máximo de lotes nesta rodada (0 = todos)")
    c.add_argument("--concorrencia", type=int, default=2, help="buscas em paralelo (-c)")
    c.add_argument("--profundidade", type=int, default=10, help="quanto rolar a lista de resultados (-depth)")
    c.add_argument("--idioma", default="pt-BR", help="idioma do Maps (-lang)")
    c.add_argument("--inatividade", default="3m", help="para o gosom se ficar parado (-exit-on-inactivity)")
    c.add_argument("--emails", action="store_true", help="pede e-mails ao gosom (-email); mais lento")
    c.add_argument("--proxies", default="", help="proxies (-proxies), ex.: http://usuario:senha@host:porta")
    c.add_argument("--timeout", type=int, default=30, help="minutos máximos por lote")
    c.add_argument("--max-tentativas", type=int, default=3, help="tentativas por lote antes de desistir")
    c.add_argument("--espera-erro", type=int, default=30, help="segundos de espera após erro (x nº da tentativa)")
    c.add_argument("--pausa-min", type=float, default=20, help="pausa mínima entre lotes (segundos)")
    c.add_argument("--pausa-max", type=float, default=60, help="pausa máxima entre lotes (segundos)")
    c.add_argument("--refazer-falhas", action="store_true", help="tenta de novo os lotes que falharam")
    c.set_defaults(func=_cmd_coletar)

    sub.add_parser("status", help="mostra o andamento e o resumo dos leads").set_defaults(func=_cmd_status)

    sub.add_parser("sincronizar-supabase", help="reenvia leads pendentes ao Supabase").set_defaults(func=_cmd_sincronizar)

    e = sub.add_parser("exportar", help="exporta os leads para CSV (abre no Excel)")
    e.add_argument("arquivo", help="ex.: leads.csv")
    e.add_argument("--ativas", action="store_true", help="só farmácias que não aparecem como fechadas")
    e.add_argument("--com-email", action="store_true", help="só leads com e-mail")
    e.add_argument("--com-telefone", action="store_true", help="só leads com telefone")
    e.add_argument("--com-celular", action="store_true", help="só leads com celular (provável WhatsApp)")
    e.add_argument("--segmento", help="só um segmento (ver comando 'segmentos')")
    e.set_defaults(func=_cmd_exportar)
    return ap


def main(argv: list[str] | None = None) -> None:
    args = _montar_parser().parse_args(argv)
    try:
        args.func(args)
    except ErroPharmaLeads as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        raise SystemExit(1)
    except (OSError, ValueError):
        print('Erro: não foi possível ler/gravar o arquivo solicitado. Confira o caminho e as permissões.', file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\nInterrompido. O lote em andamento será refeito na próxima rodada.")
        raise SystemExit(130)
