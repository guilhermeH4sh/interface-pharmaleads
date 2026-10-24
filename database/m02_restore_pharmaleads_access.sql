-- Reversão de emergência da mudança M02 em public.pharmaleads.
-- Restaura a exposição anterior. Usar somente se o impacto operacional exigir.
-- Não executar junto com m02_secure_pharmaleads.sql.
begin;

do $guard$
begin
    if exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'pharmaleads'
    ) then
        raise exception 'Há políticas novas na tabela; revisar reversão manualmente';
    end if;
end
$guard$;

grant all privileges on table public.pharmaleads to anon, authenticated;

create policy "Acesso apenas para autenticados"
    on public.pharmaleads as permissive for all to authenticated using (true);
create policy "Permitir inserção e atualização"
    on public.pharmaleads as permissive for all to public using (true);
create policy "Permitir leitura pública"
    on public.pharmaleads as permissive for select to public using (true);
create policy pharmaleads_delete_policy
    on public.pharmaleads as permissive for delete to service_role using (true);
create policy pharmaleads_insert_policy
    on public.pharmaleads as permissive for insert to authenticated, service_role
    with check (true);
create policy pharmaleads_select_policy
    on public.pharmaleads as permissive for select to anon, authenticated using (true);
create policy pharmaleads_update_policy
    on public.pharmaleads as permissive for update to authenticated, service_role
    using (true) with check (true);

commit;
