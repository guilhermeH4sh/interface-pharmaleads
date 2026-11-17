-- NULL indica lead legado ainda não processado. '' indica UF desconhecida.
ALTER TABLE public.pharmaleads ADD COLUMN IF NOT EXISTS uf_prospeccao text;

CREATE OR REPLACE FUNCTION public.pharmaleads_uf(endereco text, local_busca text, dados_brutos jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT coalesce(
    substring(upper(trim($3->'ibge'->>'uf')) FROM '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'),
    substring($1 FROM '.*,\s*[^,-]+\s*-\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:,|$)'),
    substring(upper(trim($2)) FROM ',\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$')
  );
$$;

CREATE OR REPLACE FUNCTION public.atualizar_uf_prospeccao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.uf_prospeccao := coalesce(public.pharmaleads_uf(NEW.endereco, NEW.local_busca, NEW.dados_brutos), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pharmaleads_atualizar_uf_prospeccao ON public.pharmaleads;
CREATE TRIGGER pharmaleads_atualizar_uf_prospeccao
  BEFORE INSERT OR UPDATE OF endereco, local_busca, dados_brutos, uf_prospeccao
  ON public.pharmaleads
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_uf_prospeccao();

-- Campo calculado para filtrar a origem no PostgREST com a RLS da tabela.
CREATE OR REPLACE FUNCTION public.fonte_prospeccao(public.pharmaleads)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE coalesce(nullif(trim($1.dados_brutos->>'fonte_dados'), ''), 'Google Maps')
    WHEN 'Google Maps' THEN 'Google Maps'
    WHEN 'Google Meu Negócio' THEN 'Google Meu Negócio'
    WHEN 'Receita Federal' THEN 'Receita Federal'
    ELSE 'Outras fontes'
  END;
$$;

NOTIFY pgrst, 'reload schema';
