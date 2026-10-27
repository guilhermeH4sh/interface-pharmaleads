-- Renumera exclusivamente o piloto M05 atual de public.pharmaleads.
-- Pré-condições: exatamente 100 linhas, IDs atuais acima de 100 e nenhuma FK de entrada.
-- Preserva a ordem dos IDs atuais e deixa o próximo identity em 101.

begin;

lock table public.pharmaleads in access exclusive mode;

do $$
declare
    row_count bigint;
    min_id bigint;
begin
    select count(*), min(id)
      into row_count, min_id
      from public.pharmaleads;

    if row_count <> 100 then
        raise exception 'Renumeracao bloqueada: esperado piloto com 100 linhas.';
    end if;

    if min_id <= 100 then
        raise exception 'Renumeracao bloqueada: faixa 1-100 ja esta em uso.';
    end if;

    if exists (
        select 1
          from pg_constraint
         where contype = 'f'
           and confrelid = 'public.pharmaleads'::regclass
    ) then
        raise exception 'Renumeracao bloqueada: existe chave estrangeira apontando para pharmaleads.';
    end if;

    if not exists (
        select 1
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'pharmaleads'
           and column_name = 'id'
           and is_identity = 'YES'
    ) then
        raise exception 'Renumeracao bloqueada: id nao e identity.';
    end if;
end
$$;

with ordered as materialized (
    select id as old_id,
           row_number() over (order by id)::bigint as new_id
      from public.pharmaleads
)
update public.pharmaleads as target
   set id = ordered.new_id
  from ordered
 where target.id = ordered.old_id;

do $$
declare
    row_count bigint;
    min_id bigint;
    max_id bigint;
begin
    select count(*), min(id), max(id)
      into row_count, min_id, max_id
      from public.pharmaleads;

    if row_count <> 100 or min_id <> 1 or max_id <> 100 then
        raise exception 'Renumeracao bloqueada: validacao final dos IDs falhou.';
    end if;
end
$$;

alter table public.pharmaleads alter column id restart with 101;

commit;

select count(*) as total, min(id) as primeiro_id, max(id) as ultimo_id
  from public.pharmaleads;
