-- M02, 24/10/2026. Aplicar somente no projeto qxsdcrywsjkrpcbfgbxb,
-- banco principal, após conferir no painel que o alvo é public.pharmaleads.
-- Transação atômica: nenhuma linha, outra tabela, schema ou papel é alterado.
begin;

do $guard$
declare
    actual_policies text[];
begin
    if not exists (
        select 1
        from pg_class c
        where c.oid = 'public.pharmaleads'::regclass
          and c.relrowsecurity
          and not c.relforcerowsecurity
    ) then
        raise exception 'RLS de public.pharmaleads divergiu; nenhuma alteração aplicada';
    end if;

    select array_agg(policyname order by policyname)
      into actual_policies
      from pg_policies
     where schemaname = 'public' and tablename = 'pharmaleads';

    if actual_policies is distinct from array[
        'Acesso apenas para autenticados',
        'Permitir inserção e atualização',
        'Permitir leitura pública',
        'pharmaleads_delete_policy',
        'pharmaleads_insert_policy',
        'pharmaleads_select_policy',
        'pharmaleads_update_policy'
    ]::text[] then
        raise exception 'Políticas de public.pharmaleads divergiram; nenhuma alteração aplicada';
    end if;

    if not exists (
        select 1 from pg_roles
         where rolname = 'service_role' and rolbypassrls
    ) then
        raise exception 'service_role não possui BYPASSRLS; nenhuma alteração aplicada';
    end if;
end
$guard$;

drop policy "Acesso apenas para autenticados" on public.pharmaleads;
drop policy "Permitir inserção e atualização" on public.pharmaleads;
drop policy "Permitir leitura pública" on public.pharmaleads;
drop policy pharmaleads_delete_policy on public.pharmaleads;
drop policy pharmaleads_insert_policy on public.pharmaleads;
drop policy pharmaleads_select_policy on public.pharmaleads;
drop policy pharmaleads_update_policy on public.pharmaleads;

revoke all privileges on table public.pharmaleads from anon, authenticated;

do $verify$
begin
    if exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'pharmaleads'
    ) or exists (
        select 1 from pg_roles r
         where r.rolname in ('anon', 'authenticated')
           and (
               has_table_privilege(r.rolname, 'public.pharmaleads', 'SELECT')
            or has_table_privilege(r.rolname, 'public.pharmaleads', 'INSERT')
            or has_table_privilege(r.rolname, 'public.pharmaleads', 'UPDATE')
            or has_table_privilege(r.rolname, 'public.pharmaleads', 'DELETE')
           )
    ) or not has_table_privilege('service_role', 'public.pharmaleads', 'SELECT') then
        raise exception 'Pós-condição de acesso falhou; transação revertida';
    end if;
end
$verify$;

commit;
