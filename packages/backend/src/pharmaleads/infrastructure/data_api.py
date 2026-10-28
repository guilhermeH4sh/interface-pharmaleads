"""Conexão M02 da Data API, limitada a public.pharmaleads.

O probe usa a chave publicável (papel anon). Após a correção de RLS do M02,
anon não tem acesso à tabela; respostas 401/403 confirmam conectividade com
RLS restrita funcionando corretamente.
"""

import json
import os
import re
import ssl
from http.client import HTTPException, HTTPSConnection

from pharmaleads.infrastructure.database.constants import AUTHORIZED_PROJECT_REF

HOST = f"{AUTHORIZED_PROJECT_REF}.supabase.co"
PATH = "/rest/v1/pharmaleads?select=id&limit=0"
KEY_ENV = "PHARMALEADS_DATA_API_PUBLISHABLE_KEY"


def validate_publishable_key(publishable_key: str) -> None:
    if not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", publishable_key):
        raise ValueError("Chave publicável inválida.")


# Respostas que confirmam conectividade com o servidor Supabase.
# 200/206 = acesso permitido; 401/403 = servidor respondeu, RLS restrita (esperado após M02).
CONNECTED_STATUSES: frozenset[int] = frozenset({200, 206, 401, 403})


def probe(publishable_key: str) -> int:
    """Retorna o status HTTP de HEAD; não lê corpo ou outras rotas."""
    validate_publishable_key(publishable_key)

    connection = HTTPSConnection(HOST, timeout=10, context=ssl.create_default_context())
    try:
        connection.request(
            "HEAD",
            PATH,
            headers={
                "apikey": publishable_key,
                "Accept-Profile": "public",
                "Accept": "application/json",
            },
        )
        response = connection.getresponse()
        return response.status
    finally:
        connection.close()


def main() -> int:
    key = os.environ.get(KEY_ENV, "")
    try:
        status = probe(key)
    except (ValueError, OSError, HTTPException):
        print("M02 Data API: falha de conexão ou configuração; detalhes omitidos.")
        return 1
    if status not in CONNECTED_STATUSES:
        print(f"M02 Data API: resposta HTTP {status}; conexão não confirmada.")
        return 1
    rls_active = status in {401, 403}
    print(
        json.dumps(
            {
                "connection": "ok",
                "transport": "supabase_data_api",
                "table": "public.pharmaleads",
                "method": "HEAD",
                "rls_restricted": rls_active,
                "http_status": status,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
