-- M07 reduzido: vínculo de site exclusivamente em public.pharmaleads.
-- Não cria tabela, função, trigger, índice, schema ou papel.
-- O papel aplicativo revisor será reconciliado no M11 (D-07); neste piloto remoto,
-- revisão usa os papéis internos já autorizados por RLS: admin ou operador.

begin;

alter table public.pharmaleads
    add column if not exists site_candidate_url text,
    add column if not exists site_resolved_url text,
    add column if not exists site_source_id text,
    add column if not exists site_state text,
    add column if not exists site_link_kind text,
    add column if not exists site_evidence jsonb not null default '{}'::jsonb,
    add column if not exists site_review_version bigint not null default 0,
    add column if not exists site_reviewed_by text,
    add column if not exists site_reviewed_at timestamptz,
    add column if not exists site_updated_at timestamptz;

alter table public.pharmaleads
    drop constraint if exists pharmaleads_site_state_check,
    add constraint pharmaleads_site_state_check check (
        site_state is null or site_state in (
            'candidate', 'review_required', 'confirmed', 'rejected'
        )
    ),
    drop constraint if exists pharmaleads_site_link_kind_check,
    add constraint pharmaleads_site_link_kind_check check (
        site_link_kind is null or site_link_kind in (
            'branch_exact', 'same_network', 'other_company', 'unconfirmed'
        )
    ),
    drop constraint if exists pharmaleads_site_review_version_check,
    add constraint pharmaleads_site_review_version_check check (site_review_version >= 0),
    drop constraint if exists pharmaleads_site_shape_check,
    add constraint pharmaleads_site_shape_check check (
        (site_state is null and site_candidate_url is null and site_source_id is null)
        or
        (site_state is not null and site_candidate_url is not null and site_source_id is not null)
    );

grant update (
    website, site_candidate_url, site_resolved_url, site_source_id, site_state,
    site_link_kind, site_evidence, site_review_version, site_reviewed_by,
    site_reviewed_at, site_updated_at
) on table public.pharmaleads to authenticated;

commit;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'pharmaleads'
   and column_name like 'site\_%' escape '\'
 order by ordinal_position;
