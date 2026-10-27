"""Planejamento de egress que bloqueia SSRF e DNS rebinding."""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from urllib.parse import SplitResult, urljoin, urlsplit, urlunsplit

Resolver = Callable[[str, int], Iterable[str]]
ALLOWED_PORTS = frozenset({80, 443})
MAX_URL_LENGTH = 2048


class UrlSecurityError(ValueError):
    """URL não pode ser acessada pela política de egress."""


@dataclass(frozen=True)
class EgressTarget:
    url: str
    scheme: str
    host: str
    port: int
    path_and_query: str
    addresses: tuple[str, ...]


def system_resolver(host: str, port: int) -> tuple[str, ...]:
    try:
        records = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UrlSecurityError("DNS não resolveu o domínio.") from exc
    return tuple(dict.fromkeys(str(record[4][0]) for record in records))


def _public_address(value: str) -> str:
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise UrlSecurityError("DNS retornou endereço inválido.") from exc
    if not address.is_global:
        raise UrlSecurityError("Destino privado, local ou reservado bloqueado.")
    return address.compressed


def _normalized_parts(raw_url: str) -> tuple[SplitResult, str, int]:
    candidate = raw_url.strip()
    if not candidate or len(candidate) > MAX_URL_LENGTH:
        raise UrlSecurityError("URL vazia ou acima do limite.")
    if any(ord(char) < 32 for char in candidate) or "\\" in candidate:
        raise UrlSecurityError("URL contém caracteres proibidos.")
    try:
        parsed = urlsplit(candidate)
        port = parsed.port
    except ValueError as exc:
        raise UrlSecurityError("URL inválida.") from exc
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise UrlSecurityError("Somente HTTP e HTTPS são permitidos.")
    if parsed.username is not None or parsed.password is not None:
        raise UrlSecurityError("Credenciais embutidas na URL são proibidas.")
    if not parsed.hostname or parsed.fragment:
        raise UrlSecurityError("Host ausente ou fragmento não permitido.")
    try:
        host = parsed.hostname.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise UrlSecurityError("Domínio inválido.") from exc
    if not host or host == "localhost" or "." not in host:
        try:
            ipaddress.ip_address(host)
        except ValueError as exc:
            raise UrlSecurityError("Domínio local ou sem sufixo público bloqueado.") from exc
    effective_port = port or (443 if scheme == "https" else 80)
    if effective_port not in ALLOWED_PORTS:
        raise UrlSecurityError("Porta de destino não permitida.")
    return parsed, host, effective_port


def plan_egress(raw_url: str, resolver: Resolver = system_resolver) -> EgressTarget:
    parsed, host, port = _normalized_parts(raw_url)
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        resolved = tuple(resolver(host, port))
    else:
        resolved = (str(literal),)
    if not resolved:
        raise UrlSecurityError("DNS não retornou endereços.")
    addresses = tuple(dict.fromkeys(_public_address(value) for value in resolved))
    host_for_url = f"[{host}]" if ":" in host else host
    default_port = 443 if parsed.scheme.lower() == "https" else 80
    authority = host_for_url if port == default_port else f"{host_for_url}:{port}"
    path = parsed.path or "/"
    normalized = urlunsplit((parsed.scheme.lower(), authority, path, parsed.query, ""))
    path_and_query = path + (f"?{parsed.query}" if parsed.query else "")
    return EgressTarget(
        url=normalized,
        scheme=parsed.scheme.lower(),
        host=host,
        port=port,
        path_and_query=path_and_query,
        addresses=addresses,
    )


def plan_redirect(
    current_url: str,
    location: str,
    resolver: Resolver = system_resolver,
) -> EgressTarget:
    if not location.strip():
        raise UrlSecurityError("Redirecionamento sem destino.")
    return plan_egress(urljoin(current_url, location), resolver)
