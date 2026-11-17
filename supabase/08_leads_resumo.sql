-- Agrega apenas registros visíveis pelas políticas atuais da tabela.
CREATE OR REPLACE FUNCTION public.leads_resumo()
RETURNS TABLE (
  "totalLeads" bigint,
  qualificados bigint,
  "emContato" bigint,
  estados bigint
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*),
    count(*) FILTER (WHERE crm_included IS NOT FALSE AND crm_status = 'Qualificado'),
    count(*) FILTER (WHERE crm_included IS NOT FALSE AND crm_status = 'Em contato'),
    count(DISTINCT nullif(uf_prospeccao, ''))
  FROM public.pharmaleads;
$$;

REVOKE ALL ON FUNCTION public.leads_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_resumo() TO authenticated;
NOTIFY pgrst, 'reload schema';
