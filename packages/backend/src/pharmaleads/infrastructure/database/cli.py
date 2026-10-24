"""Entradas seguras para inspeção e migração; nunca imprimem configuração/SQL de erro."""

import argparse
import json
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from pharmaleads.infrastructure.database.session import database_engine
from pharmaleads.infrastructure.database.settings import DatabaseSettings


def main() -> None:
    parser = argparse.ArgumentParser(description="M02: banco explicitamente identificado")
    parser.add_argument("action", choices=["inspect", "upgrade", "downgrade", "sql"])
    parser.add_argument("--config", type=Path, default=Path("database/alembic.ini"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.config.is_file():
        parser.error("Configuração Alembic ausente: execute na raiz ou informe --config.")
    cfg = Config(str(args.config.resolve()))
    try:
        if args.action == "sql":
            command.upgrade(cfg, "head", sql=True)
            return
        settings = DatabaseSettings()
        if args.action == "inspect":
            engine = database_engine(settings, migration=True)
            try:
                with engine.connect() as connection, connection.begin():
                    connection.execute(text("SET TRANSACTION READ ONLY"))
                    rows = (
                        connection.execute(
                            text("""
                        SELECT a.attname AS name,
                               pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
                               a.attnotnull AS not_null,
                               c.relrowsecurity AS rls_enabled
                        FROM pg_catalog.pg_attribute a
                        JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
                        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname='public' AND c.relname='pharmaleads'
                          AND c.relkind IN ('r','p') AND a.attnum > 0
                          AND NOT a.attisdropped
                        ORDER BY a.attnum
                    """)
                        )
                        .mappings()
                        .all()
                    )
                    if not rows:
                        parser.error("public.pharmaleads não encontrada no destino informado.")
                    print(
                        json.dumps(
                            {
                                "connection": "ok",
                                "table": "public.pharmaleads",
                                "rls_enabled": rows[0]["rls_enabled"],
                                "columns": [
                                    {
                                        "name": row["name"],
                                        "type": row["type"],
                                        "not_null": row["not_null"],
                                    }
                                    for row in rows
                                ],
                            },
                            ensure_ascii=False,
                        )
                    )
            finally:
                engine.dispose()
        else:
            if not args.apply:
                parser.error("Alteração exige --apply após inspeção do destino e revisão do SQL.")
            if not settings.local_test:
                parser.error(
                    "Migration M02 multischema bloqueada fora de PostgreSQL local "
                    "descartável; o Supabase autorizado permite apenas public.pharmaleads."
                )
            if args.action == "upgrade":
                command.upgrade(cfg, "head")
            else:
                command.downgrade(cfg, "base")
    except Exception:
        # psycopg/SQLAlchemy/Pydantic podem incluir host, senha, parâmetros ou SQL em erros.
        print("M02 falhou: verifique destino, TLS, papéis e pré-condições. Detalhes não expostos.")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
