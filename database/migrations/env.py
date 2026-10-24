"""Alembic único; sem autogeração ampla ou alteração de objetos de outros sistemas."""

from alembic import context
from sqlalchemy import text

from pharmaleads.infrastructure.database.session import database_engine
from pharmaleads.infrastructure.database.settings import DatabaseSettings

SCHEMAS = ("ingest", "core", "coleta", "comercial", "audit", "privacy")

# Executado sob o papel de migração. Primeiro upgrade não adota schemas existentes.
PREFLIGHT = """
DO $guard$
BEGIN
  IF current_user <> 'phl_migration' THEN
    RAISE EXCEPTION 'Papel de migração inválido';
  END IF;
  IF EXISTS (SELECT FROM pg_catalog.pg_roles
      WHERE rolname IN ('phl_migration','phl_runtime','phl_coleta')
        AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolcanlogin))
     OR (SELECT count(*) FROM pg_catalog.pg_roles
         WHERE rolname IN ('phl_migration','phl_runtime','phl_coleta')) <> 3 THEN
    RAISE EXCEPTION 'Papéis ausentes ou privilegiados; inspecionar bootstrap';
  END IF;
  IF pg_has_role('phl_runtime','phl_migration','MEMBER')
     OR pg_has_role('phl_coleta','phl_migration','MEMBER')
     OR pg_has_role('phl_coleta','phl_runtime','MEMBER')
     OR pg_has_role('phl_runtime','phl_coleta','MEMBER') THEN
    RAISE EXCEPTION 'Papéis operacionais não podem herdar outros papéis phl_*';
  END IF;
  IF to_regclass('audit.alembic_version') IS NULL THEN
    IF EXISTS (SELECT FROM pg_catalog.pg_namespace
      WHERE nspname IN ('ingest','core','coleta','comercial','audit','privacy')) THEN
      RAISE EXCEPTION 'Schema preexistente: não adotar nem sobrescrever';
    END IF;
    CREATE SCHEMA audit AUTHORIZATION phl_migration;
    REVOKE ALL ON SCHEMA audit FROM PUBLIC;
  ELSE
    IF EXISTS (SELECT FROM pg_catalog.pg_namespace
       WHERE nspname IN ('ingest','core','coleta','comercial','audit','privacy')
         AND nspowner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='phl_migration'))
       OR (SELECT relowner FROM pg_catalog.pg_class
           WHERE oid=to_regclass('audit.alembic_version')) <>
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='phl_migration') THEN
      RAISE EXCEPTION 'Propriedade incompatível: inspecionar antes de migrar';
    END IF;
  END IF;
END
$guard$;
"""


def run_offline() -> None:
    context.configure(
        dialect_name="postgresql",
        version_table_schema="audit",
        literal_binds=True,
        transactional_ddl=True,
    )
    with context.begin_transaction():
        context.execute("SET LOCAL ROLE phl_migration")
        context.execute("SELECT pg_catalog.pg_advisory_xact_lock(17429, 2)")
        context.execute(PREFLIGHT)
        context.run_migrations()


def run_online() -> None:
    settings = DatabaseSettings()
    engine = database_engine(settings, migration=True)
    try:
        with engine.connect() as connection, connection.begin():
            connection.execute(text("SET LOCAL ROLE phl_migration"))
            connection.execute(text("SELECT pg_catalog.pg_advisory_xact_lock(17429, 2)"))
            connection.execute(text(PREFLIGHT))
            context.configure(
                connection=connection,
                version_table_schema="audit",
                transactional_ddl=True,
                # Sem reflexão/autogenerate de public, auth, storage ou outros objetos.
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_offline()
else:
    run_online()
