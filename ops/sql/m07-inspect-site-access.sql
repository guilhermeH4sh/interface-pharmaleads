-- Inspeção M07 somente de metadados de public.pharmaleads.
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
        'site_update_columns',
        grantee,
        count(distinct column_name)::text
      from information_schema.column_privileges
     where table_schema = 'public'
       and table_name = 'pharmaleads'
       and (column_name like 'site\_%' escape '\' or column_name = 'website')
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
