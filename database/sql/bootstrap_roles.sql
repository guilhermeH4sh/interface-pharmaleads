-- Executar somente após identificar e aprovar o banco segregado de desenvolvimento/teste.
-- Login administrativo fora da aplicação; sem senhas neste arquivo. Colisões abortam tudo.
BEGIN;
DO $body$
BEGIN
  IF coalesce(current_setting('pharmaleads.environment', true),'')
       NOT IN ('development','test')
     OR current_setting('pharmaleads.target_database', true)
       IS DISTINCT FROM current_database() THEN
    RAISE EXCEPTION 'Identifique explicitamente ambiente e banco aprovados nesta sessão';
  END IF;
  IF EXISTS (SELECT FROM pg_catalog.pg_roles
             WHERE rolname IN ('phl_migration', 'phl_runtime', 'phl_coleta')) THEN
    RAISE EXCEPTION 'Papéis phl_* preexistentes: inspecionar; não assumir propriedade';
  END IF;
  CREATE ROLE phl_migration NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  CREATE ROLE phl_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  CREATE ROLE phl_coleta NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  EXECUTE format('GRANT phl_migration TO %I', current_user);
  EXECUTE format('GRANT CREATE ON DATABASE %I TO phl_migration', current_database());
END
$body$;
COMMIT;
