-- EMERGÊNCIA: interrompe apenas a manutenção de e-mail desta correção.
-- Não altera a coleta do Render nem exclui leads.
SET statement_timeout = '10s';

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('pharmaleads-email-index', 'pharmaleads-email-backfill');

-- Retirar o agendamento não garante o cancelamento de uma execução já ativa.
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = current_database()
  AND state = 'active'
  AND application_name ILIKE 'pg_cron%'
  AND (
    query ILIKE '%public.pharmaleads_preencher_email_publico(%'
    OR query ILIKE '%CREATE INDEX%pharmaleads_email_publico_uf_chave_idx%'
  );
