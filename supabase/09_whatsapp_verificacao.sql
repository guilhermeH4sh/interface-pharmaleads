ALTER TABLE public.pharmaleads
  ADD COLUMN IF NOT EXISTS whatsapp_verificacao jsonb
  CHECK (whatsapp_verificacao IS NULL OR coalesce(
    jsonb_typeof(whatsapp_verificacao) = 'object'
    AND whatsapp_verificacao->>'estado' IN ('confirmado', 'indisponivel')
    AND whatsapp_verificacao->>'numero' ~ '^55[1-9][0-9]{9,10}$'
    AND jsonb_typeof(whatsapp_verificacao->'verificado_em') = 'string', false));

NOTIFY pgrst, 'reload schema';
