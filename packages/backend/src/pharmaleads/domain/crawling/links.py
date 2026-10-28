"""Seleção determinística de páginas institucionais relevantes no domínio confirmado."""

from __future__ import annotations

from urllib.parse import urljoin, urlsplit, urlunsplit

from parsel import Selector

RELEVANT_TERMS = (
    "contato",
    "contact",
    "fale-conosco",
    "atendimento",
    "sobre",
    "quem-somos",
    "institucional",
    "suporte",
)


def relevant_links(html: str, *, source_url: str, confirmed_host: str) -> tuple[str, ...]:
    selector = Selector(text=html, type="html")
    found: set[str] = set()
    for anchor in selector.css("a"):
        href = anchor.attrib.get("href", "").strip()
        label = " ".join(anchor.css("::text").getall()).casefold()
        if not href or href.startswith(("#", "mailto:", "tel:", "whatsapp:")):
            continue
        absolute = urljoin(source_url, href)
        parsed = urlsplit(absolute)
        host = (parsed.hostname or "").encode("idna").decode("ascii").lower()
        haystack = f"{parsed.path.casefold()} {label}"
        if (
            parsed.scheme.lower() in {"http", "https"}
            and host == confirmed_host
            and any(term in haystack for term in RELEVANT_TERMS)
        ):
            found.add(
                urlunsplit(
                    (parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", "", "")
                )
            )
    return tuple(sorted(found))
