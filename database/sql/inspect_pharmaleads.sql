-- Somente metadados. Não exclui nem lê registros da tabela.
-- Executar após identificar o projeto correto. Pode haver homônimos em vários schemas.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.relkind
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.relname='pharmaleads' AND c.relkind IN ('r','p')
ORDER BY n.nspname;

SELECT ns.nspname AS schema_name, rel.relname AS table_name,
       con.conname AS foreign_key, pg_catalog.pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class rel ON rel.oid=con.conrelid
JOIN pg_catalog.pg_namespace ns ON ns.oid=rel.relnamespace
WHERE con.contype='f' AND con.confrelid IN (
  SELECT c.oid FROM pg_catalog.pg_class c WHERE c.relname='pharmaleads'
);

-- Dependentes adicionais (views/regras/outros objetos) exigem revisão antes de DROP RESTRICT.
SELECT pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_object,
       d.deptype
FROM pg_catalog.pg_depend d
WHERE d.refclassid='pg_catalog.pg_class'::regclass
  AND d.refobjid IN (SELECT oid FROM pg_catalog.pg_class WHERE relname='pharmaleads');
