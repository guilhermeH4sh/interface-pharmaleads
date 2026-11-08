"""Busca e-mails públicos nos sites cadastrados dos leads."""
from __future__ import annotations

import argparse
import http.client
import ipaddress
import json
import re
import socket
import ssl
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

from . import config
from .enriquecedor import EMAIL
from .recuperar_emails import bloquear_estado, salvar_estado
from .supabase import Supabase

PAGINAS_CONTATO = re.compile(r'contat[oe]|fale|atendimento|ouvidoria|quem.somos|sobre|\bsac\b', re.I)
PROVEDORES = {'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
              'uol.com.br', 'bol.com.br', 'terra.com.br', 'icloud.com'}
REDES = {'facebook.com', 'instagram.com', 'linkedin.com', 'whatsapp.com', 'wa.me',
         'google.com', 'linktr.ee', 'tiktok.com'}
SSL = ssl.create_default_context()


def normalizar(url: str) -> str:
    url = url.strip()
    if not url:
        return ''
    if '://' not in url:
        url = 'https://' + url
    try:
        partes = urlsplit(url)
        host = (partes.hostname or '').lower().rstrip('.').encode('idna').decode('ascii')
        porta = 443 if partes.scheme == 'https' else 80
        if (partes.scheme not in ('http', 'https') or '.' not in host
                or partes.username or partes.password or partes.port not in (None, porta)
                or any(c.isspace() for c in host)):
            return ''
        if any(host == rede or host.endswith('.' + rede) for rede in REDES):
            return ''
        return urlunsplit((partes.scheme, host, partes.path or '/', partes.query, ''))
    except (UnicodeError, ValueError):
        return ''


def dominio(url: str) -> str:
    return (urlsplit(url).hostname or '').removeprefix('www.')


def baixar(url: str, dominio_inicial: str) -> tuple[str, str]:
    """Limita redirecionamentos ao site original e conecta somente a IP público."""
    for _ in range(4):
        url = normalizar(url)
        if not url or dominio(url) != dominio_inicial:
            break
        partes = urlsplit(url)
        host = partes.hostname
        tls = partes.scheme == 'https'
        porta = 443 if tls else 80
        destinos = socket.getaddrinfo(host, porta, type=socket.SOCK_STREAM)
        ips = list(dict.fromkeys(destino[4][0] for destino in destinos))
        ips = [ip for ip in ips if ipaddress.ip_address(ip).is_global and not ipaddress.ip_address(ip).is_multicast]
        if not ips:
            break
        ip = next((valor for valor in ips if ':' not in valor), ips[0])
        conexao = http.client.HTTPConnection(host, porta, timeout=5)
        try:
            conexao.sock = socket.create_connection((ip, porta), timeout=5)
            if tls:
                conexao.sock = SSL.wrap_socket(conexao.sock, server_hostname=host)
            caminho = quote(partes.path or '/', safe='/:%@!$&\'()*+,;=-._~')
            if partes.query:
                caminho += '?' + quote(partes.query, safe='=&%/:?+@,;[]')
            conexao.request('GET', caminho, headers={
                'Host': host,
                'User-Agent': 'PharmaLeads/1.0 (consulta de contato público)',
                'Accept': 'text/html,application/xhtml+xml',
                'Connection': 'close',
            })
            resposta = conexao.getresponse()
            if resposta.status in (301, 302, 303, 307, 308):
                url = urljoin(url, resposta.getheader('Location', ''))
                continue
            tipo = resposta.getheader('Content-Type', '').lower()
            if resposta.status != 200 or not ('html' in tipo or not tipo):
                break
            dados = resposta.read(768 * 1024)
            charset = resposta.headers.get_content_charset() or 'utf-8'
            try:
                return url, dados.decode(charset, errors='replace')
            except LookupError:
                return url, dados.decode('utf-8', errors='replace')
        finally:
            conexao.close()
    return url, ''


class ContatosHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texto = []
        self.links = []
        self.oculto = 0

    def handle_starttag(self, tag, atributos):
        if tag in ('script', 'style', 'template'):
            self.oculto += 1
        if tag == 'a' and not self.oculto:
            href = dict(atributos).get('href')
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'template') and self.oculto:
            self.oculto -= 1

    def handle_data(self, texto):
        if not self.oculto:
            self.texto.append(texto)


def extrair(html: str, host: str) -> tuple[set[str], list[str]]:
    parser = ContatosHTML()
    parser.feed(html)
    textos = [' '.join(parser.texto)]
    textos.extend(unquote(url[7:].split('?', 1)[0]) for url in parser.links if url.lower().startswith('mailto:'))
    emails = set()
    for email in EMAIL.findall(' '.join(textos)):
        email = email.lower()
        caixa, provedor = email.rsplit('@', 1)
        if caixa in ('exemplo', 'example', 'seuemail', 'seunome') or provedor.startswith(('example.', 'exemplo.')):
            continue
        if provedor in PROVEDORES or host == provedor or host.endswith('.' + provedor) or provedor.endswith('.' + host):
            emails.add(email)
    return emails, parser.links


def buscar(site: str) -> tuple[set[str], bool]:
    host = dominio(site)
    fila = [site]
    visitados = set()
    encontrados = set()
    acessivel = False
    while fila and len(visitados) < 4:
        url = fila.pop(0)
        if url in visitados:
            continue
        visitados.add(url)
        try:
            base, html = baixar(url, host)
        except (OSError, ValueError, http.client.HTTPException):
            continue
        if not html:
            continue
        acessivel = True
        try:
            emails, links = extrair(html, host)
        except (ValueError, AssertionError):
            continue
        encontrados.update(emails)
        if len(visitados) != 1:
            continue
        for href in links:
            try:
                destino = normalizar(urljoin(base, href))
            except ValueError:
                continue
            if destino and dominio(destino) == host and PAGINAS_CONTATO.search(unquote(urlsplit(destino).path)):
                if destino not in fila and destino not in visitados:
                    fila.append(destino)
        if not fila and not encontrados:
            fila.extend(urljoin(base, caminho) for caminho in ('/contato', '/fale-conosco'))
    return encontrados, acessivel


def varrer(cliente: Supabase, caminho: Path, limite: int) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    if caminho.exists():
        estado = json.loads(caminho.read_text(encoding='utf-8'))
    else:
        sites = defaultdict(list)
        for lead in cliente.listar('chave,site', {'site': 'neq.'}):
            site = normalizar(lead['site'])
            if site:
                sites[site].append(lead['chave'])
        estado = {'sites': list(sites.items()), 'consultados': 0, 'acessiveis': 0, 'atualizados': 0}
        salvar_estado(caminho, estado)
    sites = estado['sites']
    inicio = estado['consultados']
    fim = min(len(sites), inicio + limite) if limite else len(sites)
    print(f"Fila de {len(sites)} sites para {sum(len(ids) for _, ids in sites)} leads. Retomando em {inicio}.", flush=True)
    with ThreadPoolExecutor(max_workers=16) as executor:
        for posicao in range(inicio, fim, 32):
            lote = sites[posicao:min(posicao + 32, fim)]
            resultados = executor.map(buscar, (site for site, _ in lote))
            for (_, chaves), (emails, acessivel) in zip(lote, resultados):
                estado['acessiveis'] += acessivel
                if emails:
                    encontrados = ', '.join(sorted(emails))
                    for chave in chaves:
                        estado['atualizados'] += cliente.adicionar_emails(chave, encontrados)
            estado['consultados'] += len(lote)
            salvar_estado(caminho, estado)
            print(f"{estado['consultados']}/{len(sites)} sites consultados, "
                  f"{estado['acessiveis']} acessíveis, {estado['atualizados']} leads atualizados.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limite', type=int, default=0)
    args = parser.parse_args()
    if args.limite < 0:
        parser.error('Informe um limite não negativo.')
    estado = config.pasta_dados() / 'busca_sites_emails.json'
    with bloquear_estado(estado):
        varrer(Supabase(), estado, args.limite)


if __name__ == '__main__':
    main()
