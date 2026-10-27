-- Inspeção M06 somente de metadados de public.pharmaleads.
-- Não lê linhas de leads e não executa DDL ou DML.

with checks as (
    select
        'rls'::text as category,
        'enabled'::text as item,
        c.relrowsecurity::text as value
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'pharmaleads'

    union all

    select
        'table_grant',
        grantee || ':' || privilege_type,
        'present'
      from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'pharmaleads'
       and grantee in ('anon', 'authenticated', 'service_role')

    union all

    select
        'job_update_columns',
        grantee,
        count(distinct column_name)::text
      from information_schema.column_privileges
     where table_schema = 'public'
       and table_name = 'pharmaleads'
       and column_name like 'job\_%' escape '\'
       and privilege_type = 'UPDATE'
       and grantee in ('anon', 'authenticated', 'service_role')
     group by grantee

    union all

    select
        'policy',
        policyname,
        cmd || '; roles=' || array_to_string(roles, ',')
      from pg_policies
     where schemaname = 'public'
       and tablename = 'pharmaleads'
)
select category, item, value
  from checks
 order by category, item;
