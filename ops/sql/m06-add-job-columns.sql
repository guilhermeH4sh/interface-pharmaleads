-- M06 reduzido: fila embutida exclusivamente em public.pharmaleads.
-- Não cria tabela, função, trigger, índice, schema ou papel.
-- Revisar e executar manualmente; este arquivo não é aplicado automaticamente.

begin;

alter table public.pharmaleads
    add column if not exists job_state text,
    add column if not exists job_id uuid,
    add column if not exists job_kind text,
    add column if not exists job_payload jsonb not null default '{}'::jsonb,
    add column if not exists job_fingerprint text,
    add column if not exists job_attempt integer not null default 0,
    add column if not exists job_fence bigint not null default 0,
    add column if not exists job_worker text,
    add column if not exists job_lease_until timestamptz,
    add column if not exists job_available_at timestamptz,
    add column if not exists job_checkpoint jsonb not null default '{}'::jsonb,
    add column if not exists job_error_code text,
    add column if not exists job_requested_at timestamptz,
    add column if not exists job_started_at timestamptz,
    add column if not exists job_finished_at timestamptz,
    add column if not exists job_updated_at timestamptz;

alter table public.pharmaleads
    drop constraint if exists pharmaleads_job_state_check,
    add constraint pharmaleads_job_state_check check (
        job_state is null or job_state in (
            'queued', 'running', 'retry_wait', 'cancelling',
            'succeeded', 'failed', 'cancelled'
        )
    ),
    drop constraint if exists pharmaleads_job_attempt_check,
    add constraint pharmaleads_job_attempt_check check (job_attempt between 0 and 20),
    drop constraint if exists pharmaleads_job_fence_check,
    add constraint pharmaleads_job_fence_check check (job_fence >= 0),
    drop constraint if exists pharmaleads_job_shape_check,
    add constraint pharmaleads_job_shape_check check (
        (job_state is null and job_id is null and job_kind is null and job_fingerprint is null)
        or
        (job_state is not null and job_id is not null and job_kind is not null
         and job_fingerprint is not null and length(job_fingerprint) = 64)
    );

grant update (
    job_state, job_id, job_kind, job_payload, job_fingerprint, job_attempt,
    job_fence, job_worker, job_lease_until, job_available_at, job_checkpoint,
    job_error_code, job_requested_at, job_started_at, job_finished_at, job_updated_at
) on table public.pharmaleads to authenticated;

commit;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'pharmaleads'
   and column_name like 'job_%'
 order by ordinal_position;
