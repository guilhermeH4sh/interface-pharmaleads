-- Executar isoladamente, fora de um bloco de transação, depois do script 05.
CREATE INDEX CONCURRENTLY IF NOT EXISTS pharmaleads_uf_prospeccao_chave_idx
  ON public.pharmaleads (uf_prospeccao, chave);
