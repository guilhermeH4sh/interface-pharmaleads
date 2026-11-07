"""Refaz as buscas dos leads atuais e acrescenta somente e-mails no Supabase."""
from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit

from . import config
from .banco import pegar
from .coletor import Opcoes, localizar_gosom, montar_comando
from .config import ErroPharmaLeads
from .supabase import Supabase


def consulta(lead: dict) -> str:
    link = lead.get('link') or ''
    try:
        url = urlsplit(link)
        if (url.scheme == 'https' and url.hostname in ('www.google.com', 'maps.google.com', 'maps.app.goo.gl')
                and not (url.username or url.password or '#!#' in link or any(c.isspace() for c in link))):
            return link
    except ValueError:
        pass
    partes = [lead.get(campo) or '' for campo in ('nome', 'endereco', 'local_busca')]
    return ' '.join(' '.join(partes).replace('#!#', ' ').split()) or lead['chave']


def resultados(csv_path: Path, chaves: set[str]) -> dict[str, str]:
    """Ignora resultados que não correspondem a uma chave do lote."""
    encontrados = {}
    csv.field_size_limit(20 * 1024 * 1024)
    with csv_path.open(encoding='utf-8-sig', newline='') as arquivo:
        for linha in csv.DictReader(arquivo):
            identidades = {pegar(linha, campo) for campo in ('cid', 'place_id', 'data_id', 'link')}
            if not any(identidades):
                identidades.add(f"{pegar(linha, 'title', 'name')}|{pegar(linha, 'address')}".lower())
            for chave in chaves.intersection(identidades):
                email = pegar(linha, 'emails', 'email')
                encontrados[chave] = ', '.join(filter(None, (encontrados.get(chave), email)))
    return encontrados


def salvar_estado(caminho: Path, estado: dict) -> None:
    temporario = caminho.with_suffix('.tmp')
    temporario.write_text(json.dumps(estado, ensure_ascii=False), encoding='utf-8')
    temporario.replace(caminho)


@contextmanager
def bloquear_estado(caminho: Path):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.with_suffix('.lock').open('a+b') as lock:
        try:
            if os.name == 'nt':
                import msvcrt
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as erro:
            raise ErroPharmaLeads('Já existe uma busca usando este arquivo de progresso.') from erro
        yield


def varrer(cliente: Supabase, caminho: Path, tamanho: int, limite: int, concorrencia: int) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    if caminho.exists():
        estado = json.loads(caminho.read_text(encoding='utf-8'))
    else:
        leads = list(cliente.listar('chave,nome,endereco,local_busca,link,site,emails'))
        if not leads:
            raise ErroPharmaLeads('Nenhum lead acessível no Supabase.')
        # Processa primeiro os leads com site e sem e-mail para validar a coleta cedo.
        leads.sort(key=lambda lead: (not (lead['site'] and not lead['emails']), lead['chave']))
        for lead in leads:
            del lead['emails'], lead['site']
        estado = {'leads': leads, 'consultados': 0, 'encontrados': 0, 'atualizados': 0, 'sem_correspondencia': []}
        salvar_estado(caminho, estado)

    opcoes = Opcoes(bin=localizar_gosom(), concorrencia=concorrencia, profundidade=1,
                    emails=True, inatividade='1m')
    total = len(estado['leads'])
    inicio = estado['consultados']
    fim = min(total, inicio + limite) if limite else total
    print(f'Base fixada em {total} leads. Retomando em {inicio}/{total}.', flush=True)
    with tempfile.TemporaryDirectory(prefix='pharmaleads-emails-') as pasta:
        entrada = Path(pasta) / 'consultas.txt'
        saida = Path(pasta) / 'resultados.csv'
        for posicao in range(inicio, fim, tamanho):
            lote = estado['leads'][posicao:min(posicao + tamanho, fim)]
            entrada.write_text('\n'.join(consulta(lead) for lead in lote) + '\n', encoding='utf-8')
            saida.unlink(missing_ok=True)
            print(f'Buscando leads {posicao + 1} a {posicao + len(lote)} de {total}.', flush=True)
            with caminho.with_suffix('.gosom.log').open('w', encoding='utf-8') as log:
                subprocess.run(montar_comando(opcoes, entrada, saida), check=True,
                               stdout=log, stderr=subprocess.STDOUT, timeout=opcoes.timeout_min * 60,
                               env={**os.environ, 'DISABLE_TELEMETRY': '1'})
            chaves = {lead['chave'] for lead in lote}
            encontrados = resultados(saida, chaves)
            if not encontrados:
                raise ErroPharmaLeads('Nenhum resultado correspondeu ao lote. O progresso foi preservado para retomada.')
            for chave, emails in encontrados.items():
                estado['atualizados'] += cliente.adicionar_emails(chave, emails)
            estado['consultados'] += len(lote)
            estado['encontrados'] += len(encontrados)
            estado['sem_correspondencia'].extend(sorted(chaves - encontrados.keys()))
            salvar_estado(caminho, estado)
            print(f"{estado['consultados']}/{total} consultados, {estado['encontrados']} correspondências, "
                  f"{estado['atualizados']} leads com e-mails acrescentados.", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--estado', type=Path, default=config.pasta_dados() / 'recuperacao_emails.json')
    parser.add_argument('--lote', type=int, default=160)
    parser.add_argument('--limite', type=int, default=0, help='Máximo nesta execução. Zero continua até o fim.')
    parser.add_argument('--concorrencia', type=int, choices=range(1, 9), default=4)
    args = parser.parse_args()
    if args.lote < 1 or args.limite < 0:
        parser.error('Informe lote positivo e limite não negativo.')
    try:
        with bloquear_estado(args.estado):
            varrer(Supabase(), args.estado, args.lote, args.limite, args.concorrencia)
        return 0
    except (ErroPharmaLeads, OSError, ValueError, subprocess.SubprocessError) as erro:
        print(f'Busca interrompida: {erro}', flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
