"""PostgreSQL real local/descartável. Não usa Supabase remoto nem cria banco/roles.

Pré-condições: banco vazio pharmaleads_test_*, bootstrap_roles.sql revisado/aplicado,
login de teste capaz de SET ROLE para os três papéis (superusuário local de teste).
O cenário deixa suas fixtures no banco descartável para inspeção; não faz limpeza cega.
"""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError

from pharmaleads.infrastructure.database.session import database_engine
from pharmaleads.infrastructure.database.settings import DatabaseSettings

pytestmark = pytest.mark.skipif(
    os.environ.get("PHARMALEADS_M02_INTEGRATION") != "1",
    reason="Exige opt-in e PostgreSQL local descartável explicitamente identificado.",
)
ROOT = Path(__file__).resolve().parents[2]


def denied(engine: Engine, role: str, sql: str) -> None:
    assert role in {"phl_runtime", "phl_coleta", "phl_migration"}
    with pytest.raises(DBAPIError), engine.begin() as connection:
        connection.execute(text(f"SET LOCAL ROLE {role}"))
        connection.execute(text(sql))


def test_postgresql_isolation_integrity_grants_and_rollback() -> None:
    settings = DatabaseSettings()
    assert settings.local_test and settings.environment == "test"
    engine = database_engine(settings, migration=True)
    cfg = Config(str(ROOT / "database/alembic.ini"))
    try:
        with engine.begin() as conn:
            assert not conn.execute(
                text("""
                SELECT nspname FROM pg_catalog.pg_namespace
                WHERE nspname IN ('core','ingest','coleta','audit','privacy','comercial')
            """)
            ).all(), "Banco já contém schemas: não executar fixture destrutiva."
            assert not conn.execute(
                text("""
                SELECT FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
                  ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
            """)
            ).all(), "Banco não está vazio."
            conn.execute(
                text("CREATE TABLE public.pharmaleads_m02_sentinel (id integer PRIMARY KEY)")
            )
            conn.execute(text("INSERT INTO public.pharmaleads_m02_sentinel VALUES (7)"))
            conn.execute(text("CREATE SCHEMA core"))
        with pytest.raises(Exception, match="Schema preexistente"):
            command.upgrade(cfg, "head")
        with engine.begin() as conn:
            assert conn.execute(text("SELECT to_regnamespace('audit')")).scalar() is None
            conn.execute(text("DROP SCHEMA core"))  # Criado acima por esta fixture; vazio.
        command.upgrade(cfg, "head")
        command.upgrade(cfg, "head")  # Reexecução não deve recriar objetos.
        command.downgrade(cfg, "base")  # Base sem dados permite rollback.
        command.upgrade(cfg, "head")
        first, second, lead, event = uuid4(), uuid4(), uuid4(), uuid4()
        with engine.begin() as conn:
            conn.execute(text("SET LOCAL ROLE phl_migration"))
            for identifier, cnpj in ((first, "11222333000181"), (second, "11222333000262")):
                conn.execute(
                    text("""
                    INSERT INTO core.estabelecimento
                    (id,cnpj,razao_social,matriz_filial,cnae_principal,situacao_cadastral,
                     uf,municipio_codigo,competencia)
                    VALUES (:id,:cnpj,'Fixture sintética',2,'4771701','02','SP','7107','2026-10-01')
                """),
                    {"id": identifier, "cnpj": cnpj},
                )
            conn.execute(
                text("""
                INSERT INTO comercial.lead (id,estabelecimento_id,observacoes)
                VALUES (:id,:estabelecimento,'Nota sintética preservada')
            """),
                {"id": lead, "estabelecimento": first},
            )
            for _ in range(2):
                conn.execute(
                    text("""
                    INSERT INTO audit.evento
                    (id,produtor,chave_idempotencia,acao,recurso,recurso_id,motivo_codigo)
                    VALUES (:id,'migration',:key,'fixture.criada','fixture',:resource,'TESTE')
                    ON CONFLICT (produtor,chave_idempotencia) DO NOTHING
                """),
                    {"id": uuid4(), "key": event, "resource": first},
                )
            assert conn.execute(text("SELECT count(*) FROM audit.evento")).scalar() == 1
            assert conn.execute(text("SELECT count(*) FROM core.estabelecimento")).scalar() == 2
            assert (
                conn.execute(
                    text("""
                UPDATE comercial.lead SET status='em_contato' WHERE id=:id AND version=1
                RETURNING version
            """),
                    {"id": lead},
                ).scalar()
                == 2
            )
            assert (
                conn.execute(
                    text("""
                UPDATE comercial.lead SET status='sem_interesse' WHERE id=:id AND version=1
                RETURNING version
            """),
                    {"id": lead},
                ).scalar()
                is None
            )
            conn.execute(text("UPDATE core.estabelecimento SET nome_fantasia='Atualizado'"))
            assert conn.execute(text("SELECT observacoes FROM comercial.lead")).scalar() == (
                "Nota sintética preservada"
            )
        with engine.begin() as conn:
            conn.execute(text("SET LOCAL ROLE phl_runtime"))
            assert conn.execute(text("SELECT count(*) FROM core.estabelecimento")).scalar() == 2
        for role in ("phl_runtime", "phl_coleta"):
            denied(engine, role, "SELECT * FROM comercial.lead")
            denied(engine, role, "UPDATE comercial.lead SET status='qualificado'")
            denied(engine, role, "UPDATE core.estabelecimento SET razao_social='Negado'")
            denied(engine, role, "SELECT * FROM audit.evento")
            denied(engine, role, "CREATE TABLE core.proibida(id integer)")
        denied(engine, "phl_migration", "UPDATE audit.evento SET motivo_codigo='ALTERADO'")
        denied(engine, "phl_migration", "TRUNCATE audit.evento")
        denied(engine, "phl_migration", "UPDATE core.estabelecimento SET cnpj='12ABC34501DE36'")
        with pytest.raises(Exception, match="Rollback recusado"):
            command.downgrade(cfg, "base")
        with engine.begin() as conn:
            assert (
                conn.execute(text("SELECT id FROM public.pharmaleads_m02_sentinel")).scalar() == 7
            )
            assert conn.execute(text("SELECT count(*) FROM core.estabelecimento")).scalar() == 2
            assert conn.execute(text("SELECT version FROM comercial.lead")).scalar() == 2
            assert conn.execute(text("SELECT count(*) FROM audit.evento")).scalar() == 1
    finally:
        engine.dispose()
