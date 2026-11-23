-- Execute este arquivo como uma instrução separada, fora de uma transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS pharmaleads_whatsapp_verificacao_idx
  ON public.pharmaleads ((whatsapp_verificacao->>'estado'), chave)
  WHERE whatsapp_verificacao IS NOT NULL;
