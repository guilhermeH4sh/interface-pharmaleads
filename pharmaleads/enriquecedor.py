"""Enriquecimento opcional de sites públicos dos leads com Playwright."""
from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

from .config import ErroPharmaLeads

EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
REDES = {
    'instagram': ('instagram.com',),
    'facebook': ('facebook.com', 'fb.com'),
    'linkedin': ('linkedin.com',),
}


@dataclass(frozen=True)
class ContatoSite:
    chave: str
    emails: tuple[str, ...]
    whatsapp_link: str
    redes_sociais: dict[str, str]


def url_publica(url: str) -> bool:
    """Aceita apenas páginas HTTP(S) externas; evita endereços locais óbvios."""
    try:
        partes = urlsplit(url)
        if partes.scheme not in ('http', 'https') or not partes.hostname or partes.username or partes.password:
            return False
        host = partes.hostname.lower().rstrip('.')
        if host == 'localhost' or host.endswith('.local'):
            return False
        try:
            return not ipaddress.ip_address(host).is_private and not ipaddress.ip_address(host).is_loopback
        except ValueError:
            return True
    except ValueError:
        return False


def _emails(texto: str, links: list[str]) -> tuple[str, ...]:
    encontrados = list(EMAIL.findall(texto or ''))
    encontrados.extend(unquote(link[7:].split('?', 1)[0]) for link in links if link.lower().startswith('mailto:'))
    unicos = []
    for email in encontrados:
        email = email.strip('.,;:()[]{}<>').lower()
        if email and email not in unicos:
            unicos.append(email)
    return tuple(unicos[:12])


def _whatsapp(links: list[str]) -> str:
    for link in links:
        host = (urlsplit(link).hostname or '').lower()
        if host in ('wa.me', 'api.whatsapp.com', 'web.whatsapp.com'):
            return link
    return ''


def _redes(links: list[str]) -> dict[str, str]:
    saida: dict[str, str] = {}
    for link in links:
        host = (urlsplit(link).hostname or '').lower()
        for rede, dominios in REDES.items():
            if rede not in saida and any(host == dominio or host.endswith('.' + dominio) for dominio in dominios):
                saida[rede] = link
    return saida


def enriquecer_sites(leads: list[dict], limite: int = 25) -> list[ContatoSite]:
    """Visita a página inicial de cada site e extrai somente contatos públicos."""
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright
    except ImportError as exc:
        raise ErroPharmaLeads('Playwright não está instalado para o enriquecimento de sites.') from exc

    resultados: list[ContatoSite] = []
    candidatos = [lead for lead in leads if url_publica(str(lead.get('site', '')))][:limite]
    if not candidatos:
        return resultados
    with sync_playwright() as runtime:
        navegador = runtime.chromium.launch(headless=True)
        contexto = navegador.new_context(user_agent='PharmaLeads/1.0 (+contato público)')
        try:
            for lead in candidatos:
                pagina = contexto.new_page()
                try:
                    pagina.goto(lead['site'], wait_until='domcontentloaded', timeout=15_000)
                    links = pagina.locator('a[href]').evaluate_all('(els) => els.map((a) => a.href)')
                    texto = pagina.locator('body').inner_text(timeout=5_000)[:100_000]
                    resultados.append(ContatoSite(
                        chave=lead['chave'], emails=_emails(texto, links),
                        whatsapp_link=_whatsapp(links), redes_sociais=_redes(links)))
                except PlaywrightTimeoutError:
                    continue
                except Exception:
                    # Um site individual não pode interromper a coleta do Maps.
                    continue
                finally:
                    pagina.close()
        finally:
            contexto.close()
            navegador.close()
    return resultados
