-- Aplicar no SQL Editor após 03, 05 e 09_whatsapp_verificacao.
-- Agrega no banco e respeita as políticas de acesso da sessão.
CREATE INDEX IF NOT EXISTS pharmaleads_crm_ativos_chave
  ON public.pharmaleads (chave)
  WHERE crm_included = true OR (crm_included IS NULL AND crm_status <> 'Não contatado');

CREATE OR REPLACE FUNCTION public.pharmaleads_relatorio()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
SET statement_timeout = '25s'
AS $$
WITH base AS (
  SELECT *,
    CASE WHEN crm_included IS FALSE THEN 'Não contatado'
      ELSE coalesce(crm_status, 'Não contatado') END AS etapa,
    public.fonte_prospeccao(pharmaleads) AS origem,
    CASE
      WHEN lower(coalesce(nullif(segmento, ''), categoria, '')) LIKE '%manipula%' THEN 'manipulacao'
      WHEN lower(coalesce(nullif(segmento, ''), categoria, '')) LIKE '%homeopat%' THEN 'homeopatia'
      WHEN lower(coalesce(nullif(segmento, ''), categoria, '')) ~ 'veterin|distrib' THEN 'outros'
      ELSE 'varejo' END AS grupo
  FROM public.pharmaleads
), totais AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE nullif(trim(telefone), '') IS NOT NULL AND telefone <> 'Não informado') AS telefone,
    count(*) FILTER (WHERE whatsapp_verificacao->>'estado' = 'confirmado'
      AND regexp_replace(coalesce(whatsapp_verificacao->>'numero', ''), '[^0-9]', '', 'g') ~ '^(55)?[1-9][0-9]{9,10}$') AS whatsapp,
    count(DISTINCT uf_prospeccao) FILTER (WHERE uf_prospeccao = ANY(ARRAY[
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) AS estados,
    count(*) FILTER (WHERE etapa = 'Qualificado') AS qualificados,
    count(*) FILTER (WHERE etapa = 'Em contato') AS contato,
    count(*) FILTER (WHERE etapa = 'Respondido') AS respondidos,
    count(*) FILTER (WHERE etapa = 'Não qualificado') AS nao_qualificados,
    count(*) FILTER (WHERE etapa = 'Não contatado') AS nao_contatados,
    count(*) FILTER (WHERE origem = 'Google Maps') AS maps,
    count(*) FILTER (WHERE origem = 'Google Meu Negócio') AS gmb,
    count(*) FILTER (WHERE grupo = 'varejo') AS varejo,
    count(*) FILTER (WHERE grupo = 'manipulacao') AS manipulacao,
    count(*) FILTER (WHERE grupo = 'homeopatia') AS homeopatia,
    count(*) FILTER (WHERE grupo = 'outros') AS outros
  FROM base
), percentuais AS (
  SELECT *, coalesce(round(100.0 * maps / nullif(total, 0)), 0) AS maps_pct,
    coalesce(round(100.0 * gmb / nullif(total, 0)), 0) AS gmb_pct FROM totais
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object('totalLeads', total, 'estados', estados,
    'qualificados', qualificados, 'emContato', contato, 'respondidos', respondidos,
    'naoQualificados', nao_qualificados, 'naoContatados', nao_contatados,
    'origem', jsonb_build_object(
      'googleMaps', jsonb_build_object('count', maps, 'percent', maps_pct),
      'googleMeuNegocio', jsonb_build_object('count', gmb, 'percent', gmb_pct),
      'outrasFontes', jsonb_build_object('count', total - maps - gmb,
        'percent', CASE WHEN total = 0 THEN 0 ELSE greatest(0, 100 - maps_pct - gmb_pct) END))),
  'phoneCount', telefone, 'whatsappCount', whatsapp,
  'segments', jsonb_build_object('varejo', varejo, 'manipulacao', manipulacao,
    'homeopatia', homeopatia, 'outros', outros)
) FROM percentuais;
$$;
REVOKE ALL ON FUNCTION public.pharmaleads_relatorio() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pharmaleads_relatorio() FROM anon;
GRANT EXECUTE ON FUNCTION public.pharmaleads_relatorio() TO authenticated;
NOTIFY pgrst, 'reload schema';
