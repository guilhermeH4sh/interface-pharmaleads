-- Executar depois do arquivo 01, quando as execuções tiverem parado.
-- Remove somente os objetos auxiliares novos. Preserva os campos originais e os leads.
-- Se não conseguir obter o lock em 3s, aborta sem forçar outras conexões.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DROP FUNCTION IF EXISTS public.pharmaleads_email_progresso();
DROP FUNCTION IF EXISTS public.pharmaleads_preencher_email_publico();
DROP TRIGGER IF EXISTS pharmaleads_atualizar_email_publico ON public.pharmaleads;
DROP FUNCTION IF EXISTS public.pharmaleads_atualizar_email_publico();
DROP INDEX IF EXISTS public.pharmaleads_email_publico_uf_chave_idx;
ALTER TABLE public.pharmaleads DROP COLUMN IF EXISTS tem_email_publico;
DROP FUNCTION IF EXISTS public.pharmaleads_tem_email_publico(text);

-- Funções preexistentes e políticas de acesso são preservadas.
COMMIT;
NOTIFY pgrst, 'reload schema';
