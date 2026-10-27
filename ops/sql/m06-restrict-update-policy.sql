-- M06: restringe UPDATE atual a admin e operador enquanto o CRM M11 não existe.
-- Altera somente uma política já vinculada a public.pharmaleads.
-- Impacto: gestor e responsável deixam de atualizar a linha até o desenho M11.

begin;

alter policy pharmaleads_update_policy
    on public.pharmaleads
    using (
        ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    )
    with check (
        ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    );

commit;

select
    policyname,
    cmd,
    roles::text,
    coalesce(qual, '<ausente>') as using_expression,
    coalesce(with_check, '<ausente>') as check_expression
  from pg_policies
 where schemaname = 'public'
   and tablename = 'pharmaleads'
   and policyname in ('pharmaleads_update_policy', 'pharmaleads_m05_operator_update')
 order by policyname;
