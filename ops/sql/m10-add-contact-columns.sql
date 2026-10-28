-- M10: consolidação somente na única tabela autorizada.
-- Não cria tabela, função, trigger, índice, schema ou papel.

begin;

alter table public.pharmaleads
    add column if not exists contact_records jsonb not null default '[]'::jsonb,
    add column if not exists contact_evidence jsonb not null default '[]'::jsonb,
    add column if not exists contact_review_version bigint not null default 0,
    add column if not exists contact_reviewed_by text,
    add column if not exists contact_reviewed_at timestamptz,
    add column if not exists contact_updated_at timestamptz;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'pharmaleads_contact_records_array_check'
    ) then
        alter table public.pharmaleads add constraint pharmaleads_contact_records_array_check
            check (jsonb_typeof(contact_records) = 'array');
    end if;
    if not exists (
        select 1 from pg_constraint where conname = 'pharmaleads_contact_evidence_array_check'
    ) then
        alter table public.pharmaleads add constraint pharmaleads_contact_evidence_array_check
            check (jsonb_typeof(contact_evidence) = 'array');
    end if;
    if not exists (
        select 1 from pg_constraint where conname = 'pharmaleads_contact_review_version_check'
    ) then
        alter table public.pharmaleads add constraint pharmaleads_contact_review_version_check
            check (contact_review_version >= 0);
    end if;
end $$;

grant update (
    contact_records, contact_evidence, contact_review_version,
    contact_reviewed_by, contact_reviewed_at, contact_updated_at
) on table public.pharmaleads to authenticated;

commit;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'pharmaleads'
   and column_name like 'contact\_%' escape '\'
 order by ordinal_position;
