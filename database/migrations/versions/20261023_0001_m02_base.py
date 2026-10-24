"""M02: fundação isolada; não implementa importação, coleta ou CRM funcional."""

from alembic import op

revision = "20261023_0001"
down_revision = None
branch_labels = None
depends_on = None

# SQL congelado na revisão; não importar modelos mutáveis da aplicação.
DDL = r"""
CREATE SCHEMA ingest AUTHORIZATION phl_migration;
CREATE SCHEMA core AUTHORIZATION phl_migration;
CREATE SCHEMA coleta AUTHORIZATION phl_migration;
CREATE SCHEMA comercial AUTHORIZATION phl_migration;
CREATE SCHEMA privacy AUTHORIZATION phl_migration;

CREATE FUNCTION core.cnpj_valido(candidate text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog AS $fn$
DECLARE
  body text;
  weights integer[];
  total integer;
  remainder integer;
  digit integer;
  pos integer;
  step integer;
BEGIN
  IF candidate COLLATE "C" !~ '^[A-Z0-9]{12}[0-9]{2}$'
     OR candidate = repeat(substr(candidate,1,1),14) THEN RETURN false; END IF;
  body := substr(candidate,1,12);
  FOR step IN 1..2 LOOP
    weights := CASE WHEN step=1 THEN ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]
                   ELSE ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2] END;
    total := 0;
    FOR pos IN 1..length(body) LOOP
      total := total + (ascii(substr(body,pos,1))-48) * weights[pos];
    END LOOP;
    remainder := total % 11;
    digit := CASE WHEN remainder < 2 THEN 0 ELSE 11-remainder END;
    body := body || digit::text;
  END LOOP;
  RETURN body = candidate;
END
$fn$;

CREATE TABLE core.estabelecimento (
  id uuid PRIMARY KEY,
  cnpj varchar(14) NOT NULL CONSTRAINT uq_estabelecimento_cnpj UNIQUE,
  razao_social text NOT NULL CHECK (length(razao_social) BETWEEN 1 AND 500),
  nome_fantasia text CHECK (length(nome_fantasia) <= 500),
  matriz_filial smallint NOT NULL CHECK (matriz_filial IN (1,2)),
  cnae_principal varchar(7) NOT NULL CHECK (cnae_principal ~ '^[0-9]{7}$'),
  situacao_cadastral varchar(2) NOT NULL CHECK (situacao_cadastral ~ '^[0-9]{2}$'),
  uf varchar(2) NOT NULL CHECK (uf IN
    ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
     'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  municipio_codigo text NOT NULL CHECK (municipio_codigo ~ '^[0-9]{4,7}$'),
  endereco text CHECK (length(endereco) <= 1000),
  competencia date NOT NULL,
  snapshot_version bigint NOT NULL DEFAULT 1 CHECK (snapshot_version > 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_estabelecimento_cnpj CHECK (core.cnpj_valido(cnpj))
);
CREATE INDEX ix_estabelecimento_recorte
  ON core.estabelecimento (uf, municipio_codigo, cnae_principal, situacao_cadastral);

CREATE TABLE ingest.carga (
  id uuid PRIMARY KEY,
  fonte_referencia text NOT NULL CHECK (length(fonte_referencia) BETWEEN 1 AND 200),
  competencia date NOT NULL,
  layout_version text NOT NULL CHECK (length(layout_version) BETWEEN 1 AND 100),
  arquivo_sha256 varchar(64) NOT NULL CHECK (arquivo_sha256 ~ '^[a-f0-9]{64}$'),
  estado text NOT NULL DEFAULT 'pendente'
    CHECK (estado IN ('pendente','validando','validada','rejeitada','promovida')),
  total_linhas bigint NOT NULL DEFAULT 0 CHECK (total_linhas >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_carga_estado ON ingest.carga (estado, created_at);

CREATE TABLE comercial.lead (
  id uuid PRIMARY KEY,
  estabelecimento_id uuid NOT NULL CONSTRAINT uq_lead_estabelecimento UNIQUE
    REFERENCES core.estabelecimento(id) ON DELETE RESTRICT,
  responsavel_id uuid,
  status text NOT NULL DEFAULT 'nao_contatado'
    CHECK (status IN ('nao_contatado','em_contato','respondido','qualificado','sem_interesse')),
  observacoes text CHECK (length(observacoes) <= 10000),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_lead_responsavel_status ON comercial.lead (responsavel_id, status, id);

CREATE TABLE audit.evento (
  id uuid PRIMARY KEY,
  produtor text NOT NULL CHECK (produtor IN ('migration','runtime','coleta')),
  chave_idempotencia uuid NOT NULL,
  ator_id uuid,
  acao text NOT NULL CHECK (acao ~ '^[a-z][a-z0-9_.]{0,99}$'),
  recurso text NOT NULL CHECK (recurso ~ '^[a-z][a-z0-9_.]{0,99}$'),
  recurso_id uuid NOT NULL,
  campos_alterados text[] NOT NULL DEFAULT '{}',
  request_id uuid,
  job_id uuid,
  motivo_codigo text NOT NULL CHECK (motivo_codigo ~ '^[A-Z][A-Z0-9_]{0,99}$'),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_evento_idempotencia UNIQUE (produtor, chave_idempotencia),
  CHECK (cardinality(campos_alterados) <= 30)
);
CREATE INDEX ix_evento_recurso ON audit.evento (recurso, recurso_id, created_at);

CREATE FUNCTION core.touch_estabelecimento() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
  IF NEW.cnpj <> OLD.cnpj OR NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Identidade do estabelecimento imutável';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  NEW.snapshot_version := OLD.snapshot_version + 1;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER estabelecimento_version BEFORE UPDATE ON core.estabelecimento
  FOR EACH ROW EXECUTE FUNCTION core.touch_estabelecimento();

CREATE FUNCTION comercial.touch_lead() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
  IF NEW.id <> OLD.id OR NEW.estabelecimento_id <> OLD.estabelecimento_id THEN
    RAISE EXCEPTION 'Identidade do lead imutável';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER lead_version BEFORE UPDATE ON comercial.lead
  FOR EACH ROW EXECUTE FUNCTION comercial.touch_lead();

CREATE FUNCTION audit.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
  RAISE EXCEPTION 'Evento de auditoria imutável';
END
$fn$;
CREATE TRIGGER evento_append_only BEFORE UPDATE OR DELETE ON audit.evento
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
CREATE TRIGGER evento_no_truncate BEFORE TRUNCATE ON audit.evento
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();

-- Revoga apenas nos seis schemas que esta revisão acaba de criar/assumir como próprios.
DO $acl$
DECLARE ns text; grantee text;
BEGIN
  FOREACH ns IN ARRAY ARRAY['ingest','core','coleta','comercial','audit','privacy'] LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', ns);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC', ns);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', ns);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC', ns);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', ns);
    FOR grantee IN SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('anon','authenticated','service_role','phl_runtime','phl_coleta') LOOP
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I',ns,grantee);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I',ns,grantee);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I',ns,grantee);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I',ns,grantee);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM %I',ns,grantee);
    END LOOP;
  END LOOP;
END
$acl$;

-- M02 nega acesso operacional por padrão; permissões de negócio só nos módulos próprios.
-- Runtime: leitura cadastral; nenhuma operação comercial antes de M03/M11.
GRANT USAGE ON SCHEMA core TO phl_runtime;
GRANT SELECT ON core.estabelecimento TO phl_runtime;
GRANT EXECUTE ON FUNCTION core.cnpj_valido(text) TO phl_runtime;
-- Coleta não pode ler nem alterar comercial. Escrita cadastral aguarda M04/M05.
GRANT USAGE ON SCHEMA core, ingest TO phl_coleta;
GRANT SELECT ON core.estabelecimento TO phl_coleta;
GRANT SELECT ON ingest.carga TO phl_coleta;
GRANT EXECUTE ON FUNCTION core.cnpj_valido(text) TO phl_coleta;

ALTER TABLE core.estabelecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY estabelecimento_leitura ON core.estabelecimento FOR SELECT
  TO phl_runtime, phl_coleta USING (true);
ALTER TABLE ingest.carga ENABLE ROW LEVEL SECURITY;
CREATE POLICY carga_leitura ON ingest.carga FOR SELECT TO phl_coleta USING (true);
ALTER TABLE comercial.lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.evento ENABLE ROW LEVEL SECURITY;
"""


def upgrade() -> None:
    op.execute(DDL)


def downgrade() -> None:
    # Rollback da fundação é admitido somente se não houver registros. Sem CASCADE.
    op.execute("""
DO $guard$
BEGIN
  IF EXISTS (SELECT FROM core.estabelecimento) OR EXISTS (SELECT FROM comercial.lead)
     OR EXISTS (SELECT FROM ingest.carga) OR EXISTS (SELECT FROM audit.evento) THEN
    RAISE EXCEPTION 'Rollback recusado: preservar dados e preparar migração aditiva';
  END IF;
END
$guard$;
DROP TABLE comercial.lead;
DROP TABLE ingest.carga;
DROP TABLE core.estabelecimento;
DROP TABLE audit.evento;
DROP FUNCTION comercial.touch_lead();
DROP FUNCTION core.touch_estabelecimento();
DROP FUNCTION core.cnpj_valido(text);
DROP FUNCTION audit.reject_mutation();
-- Alembic conserva audit.alembic_version vazio para registrar o downgrade.
DROP SCHEMA comercial;
DROP SCHEMA ingest;
DROP SCHEMA core;
DROP SCHEMA coleta;
DROP SCHEMA privacy;
""")
