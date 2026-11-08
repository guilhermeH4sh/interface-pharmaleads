-- Executar uma vez no SQL Editor. Afeta somente public.pharmaleads.
BEGIN;

ALTER TABLE public.pharmaleads
  DROP CONSTRAINT pharmaleads_crm_status_valid;

ALTER TABLE public.pharmaleads
  ADD CONSTRAINT pharmaleads_crm_status_valid
  CHECK (crm_status IS NULL OR crm_status IN (
    'Não contatado', 'Em contato', 'Respondido', 'Qualificado', 'Não qualificado'
  ));

COMMIT;
