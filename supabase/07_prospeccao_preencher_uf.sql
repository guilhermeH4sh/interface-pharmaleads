-- Rodar após 05 e 06. Executar novamente até atualizados retornar zero.
WITH lote AS (
  SELECT chave FROM public.pharmaleads
  WHERE uf_prospeccao IS NULL
  ORDER BY chave
  LIMIT 5000
  FOR UPDATE SKIP LOCKED
),
atualizados AS (
  UPDATE public.pharmaleads p
  SET uf_prospeccao = '' -- O trigger calcula a sigla a partir dos valores atuais.
  FROM lote
  WHERE p.chave = lote.chave
  RETURNING 1
)
SELECT count(*) AS atualizados FROM atualizados;
