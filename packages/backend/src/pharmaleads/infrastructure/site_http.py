"""HTTP limitado para inspecionar candidatos M07 sem abrir SSRF ou rebinding."""

from __future__ import annotations

import socket
import ssl
from dataclasses import dataclass
from http.client import HTTPConnection, HTTPSConnection
from typing import Protocol

from pharmaleads.domain.sites.linkage import LinkAssessment, assess_cnpj_link
from pharmaleads.domain.sites.security import (
    EgressTarget,
    Resolver,
    UrlSecurityError,
    plan_egress,
    plan_redirect,
    system_resolver,
)

MAX_BODY_BYTES = 512 * 1024
MAX_REDIRECTS = 5
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class SiteInspectionError(RuntimeError):
    """Falha sanitizada da inspeção HTTP."""


@dataclass(frozen=True)
class BoundedResponse:
    status: int
    headers: dict[str, str]
    body: bytes


@dataclass(frozen=True)
class InspectionResult:
    final_target: EgressTarget
    assessment: LinkAssessment
    redirect_chain: tuple[str, ...]
    status: int
    content_type: str


class SiteTransport(Protocol):
    def request(self, target: EgressTarget, max_body_bytes: int) -> BoundedResponse: ...


class _PinnedHTTPConnection(HTTPConnection):
    def __init__(self, host: str, address: str, port: int, timeout: float) -> None:
        self._pinned_address = address
        self._pinned_source_address: tuple[str, int] | None = None
        super().__init__(host, port=port, timeout=timeout)

    def connect(self) -> None:
        self.sock = socket.create_connection(
            (self._pinned_address, self.port), self.timeout, self._pinned_source_address
        )


class _PinnedHTTPSConnection(HTTPSConnection):
    def __init__(
        self,
        host: str,
        address: str,
        port: int,
        timeout: float,
        context: ssl.SSLContext,
    ) -> None:
        self._pinned_address = address
        self._pinned_source_address: tuple[str, int] | None = None
        self._pinned_context = context
        super().__init__(host, port=port, timeout=timeout, context=context)

    def connect(self) -> None:
        raw_socket = socket.create_connection(
            (self._pinned_address, self.port), self.timeout, self._pinned_source_address
        )
        self.sock = self._pinned_context.wrap_socket(raw_socket, server_hostname=self.host)


class PinnedSiteTransport:
    """Conecta ao IP já validado mantendo Host/SNI do domínio original."""

    def __init__(self, *, timeout: float = 10.0) -> None:
        if not 0.1 <= timeout <= 30:
            raise ValueError("Timeout HTTP fora do limite.")
        self._timeout = timeout
        self._context = ssl.create_default_context()

    def request(self, target: EgressTarget, max_body_bytes: int) -> BoundedResponse:
        if not 1 <= max_body_bytes <= MAX_BODY_BYTES:
            raise ValueError("Limite de resposta inválido.")
        address = target.addresses[0]
        connection: HTTPConnection
        if target.scheme == "https":
            connection = _PinnedHTTPSConnection(
                target.host,
                address,
                target.port,
                self._timeout,
                self._context,
            )
        else:
            connection = _PinnedHTTPConnection(target.host, address, target.port, self._timeout)
        try:
            connection.request(
                "GET",
                target.path_and_query,
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "Connection": "close",
                    "Host": target.host,
                    "Range": f"bytes=0-{max_body_bytes - 1}",
                    "User-Agent": "PharmaLeads-M07/1.0",
                },
            )
            response = connection.getresponse()
            body = response.read(max_body_bytes + 1)
            headers = {name.lower(): value for name, value in response.getheaders()}
        except (OSError, ssl.SSLError) as exc:
            raise SiteInspectionError("Falha de rede ao inspecionar candidato.") from exc
        finally:
            connection.close()
        if len(body) > max_body_bytes:
            raise SiteInspectionError("Página excede o limite de inspeção.")
        return BoundedResponse(status=response.status, headers=headers, body=body)


class SafeSiteInspector:
    def __init__(
        self,
        transport: SiteTransport | None = None,
        *,
        resolver: Resolver = system_resolver,
        max_redirects: int = MAX_REDIRECTS,
        max_body_bytes: int = MAX_BODY_BYTES,
    ) -> None:
        if not 0 <= max_redirects <= MAX_REDIRECTS:
            raise ValueError("Limite de redirecionamentos inválido.")
        if not 1 <= max_body_bytes <= MAX_BODY_BYTES:
            raise ValueError("Limite de resposta inválido.")
        self._transport = transport or PinnedSiteTransport()
        self._resolver = resolver
        self._max_redirects = max_redirects
        self._max_body_bytes = max_body_bytes

    def inspect(self, url: str, cnpj: str) -> InspectionResult:
        target = plan_egress(url, self._resolver)
        visited: set[str] = set()
        redirects: list[str] = []
        for hop in range(self._max_redirects + 1):
            if target.url in visited:
                raise SiteInspectionError("Ciclo de redirecionamento detectado.")
            visited.add(target.url)
            response = self._transport.request(target, self._max_body_bytes)
            if response.status in REDIRECT_STATUSES:
                if hop >= self._max_redirects:
                    raise SiteInspectionError("Limite de redirecionamentos excedido.")
                location = response.headers.get("location", "")
                next_target = plan_redirect(target.url, location, self._resolver)
                if target.scheme == "https" and next_target.scheme != "https":
                    raise UrlSecurityError("Redirecionamento HTTPS para HTTP bloqueado.")
                redirects.append(next_target.url)
                target = next_target
                continue
            if not 200 <= response.status < 300:
                raise SiteInspectionError(f"Site respondeu HTTP {response.status}.")
            content_type = response.headers.get("content-type", "").lower()
            if not content_type.startswith(("text/html", "application/xhtml+xml")):
                raise SiteInspectionError("Resposta final não é HTML.")
            text = response.body.decode("utf-8", errors="replace")
            return InspectionResult(
                final_target=target,
                assessment=assess_cnpj_link(cnpj, text),
                redirect_chain=tuple(redirects),
                status=response.status,
                content_type=content_type,
            )
        raise SiteInspectionError("Inspeção não alcançou resposta final.")
