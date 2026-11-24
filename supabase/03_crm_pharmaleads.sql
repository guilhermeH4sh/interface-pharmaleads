-- Migração reexecutável. Preserva os valores e defaults já existentes.
BEGIN;
ALTER TABLE public.pharmaleads ADD COLUMN IF NOT EXISTS crm_included boolean;
ALTER TABLE public.pharmaleads ADD COLUMN IF NOT EXISTS crm_status text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pharmaleads'::regclass
      AND conname = 'pharmaleads_crm_status_valid') THEN
    ALTER TABLE public.pharmaleads ADD CONSTRAINT pharmaleads_crm_status_valid
      CHECK (crm_status IS NULL OR crm_status IN
        ('Não contatado', 'Em contato', 'Respondido', 'Qualificado', 'Não qualificado'));
  END IF;
END;
$$;
COMMIT;
NOTIFY pgrst, 'reload schema';
