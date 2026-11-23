-- Execute este arquivo como uma instrução separada, fora de uma transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS pharmaleads_prospeccao_com_email_idx
  ON public.pharmaleads (uf_prospeccao, chave)
  INCLUDE (crm_included, crm_status)
  WHERE emails LIKE '%@%.%';
