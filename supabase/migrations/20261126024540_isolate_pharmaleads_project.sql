-- Destino exclusivo: zofekhywrxlgziqcfeml. Nenhum job SQL é criado.
SET lock_timeout='3s';
SET statement_timeout='25s';
CREATE TABLE public.pharmaleads (
  "chave" text NOT NULL,
  "nome" text DEFAULT ''::text NOT NULL,
  "segmento" text DEFAULT ''::text NOT NULL,
  "categoria" text DEFAULT ''::text NOT NULL,
  "endereco" text DEFAULT ''::text NOT NULL,
  "local_busca" text DEFAULT ''::text NOT NULL,
  "telefone" text DEFAULT ''::text NOT NULL,
  "telefone_normalizado" text DEFAULT ''::text NOT NULL,
  "celular" integer DEFAULT 0 NOT NULL,
  "whatsapp_link" text DEFAULT ''::text NOT NULL,
  "site" text DEFAULT ''::text NOT NULL,
  "emails" text DEFAULT ''::text NOT NULL,
  "score_contato" integer DEFAULT 0 NOT NULL,
  "latitude" text DEFAULT ''::text NOT NULL,
  "longitude" text DEFAULT ''::text NOT NULL,
  "avaliacao" text DEFAULT ''::text NOT NULL,
  "qtd_avaliacoes" text DEFAULT ''::text NOT NULL,
  "status_maps" text DEFAULT ''::text NOT NULL,
  "situacao" text DEFAULT ''::text NOT NULL,
  "link" text DEFAULT ''::text NOT NULL,
  "dados_brutos" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "primeira_coleta" timestamp with time zone,
  "ultima_coleta" timestamp with time zone,
  "crm_included" boolean DEFAULT false NOT NULL,
  "crm_status" text DEFAULT 'Não contatado'::text NOT NULL,
  "uf_prospeccao" text,
  "whatsapp_verificacao" jsonb,
  "tem_email_publico" boolean,
  CONSTRAINT "pharmaleads_pkey" PRIMARY KEY (chave),
  CONSTRAINT "pharmaleads_crm_status_valid" CHECK (((crm_status IS NULL) OR (crm_status = ANY (ARRAY['Não contatado'::text, 'Em contato'::text, 'Respondido'::text, 'Qualificado'::text, 'Não qualificado'::text])))),
  CONSTRAINT "pharmaleads_whatsapp_verificacao_check" CHECK (((whatsapp_verificacao IS NULL) OR COALESCE(((jsonb_typeof(whatsapp_verificacao) = 'object'::text) AND ((whatsapp_verificacao ->> 'estado'::text) = ANY (ARRAY['confirmado'::text, 'indisponivel'::text])) AND ((whatsapp_verificacao ->> 'numero'::text) ~ '^55[1-9][0-9]{9,10}$'::text) AND (jsonb_typeof((whatsapp_verificacao -> 'verificado_em'::text)) = 'string'::text)), false)))
);
ALTER TABLE public.pharmaleads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pharmaleads FROM PUBLIC, anon;
GRANT SELECT,INSERT,UPDATE ON public.pharmaleads TO authenticated;
GRANT ALL ON public.pharmaleads TO service_role;
CREATE POLICY "pharmaleads_atualizacao" ON public.pharmaleads AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid)) WITH CHECK ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid));
CREATE POLICY "pharmaleads_insercao" ON public.pharmaleads AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid));
CREATE POLICY "pharmaleads_leitura" ON public.pharmaleads AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid));
CREATE POLICY "pharmaleads_uid_restrito" ON public.pharmaleads AS RESTRICTIVE FOR ALL TO "public" USING ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid)) WITH CHECK ((( SELECT auth.uid() AS uid) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid));
CREATE OR REPLACE FUNCTION public.pharmaleads_uf(endereco text, local_busca text, dados_brutos jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  SELECT coalesce(
    substring(upper(trim($3->'ibge'->>'uf')) FROM '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'),
    substring($1 FROM '.*,\s*[^,-]+\s*-\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:,|$)'),
    substring(upper(trim($2)) FROM ',\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$')
  );
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_uf(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_uf(text,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.pharmaleads_tem_email_publico(texto text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM regexp_split_to_table(lower(coalesce(texto, '')), '[,;[:space:]]+') AS t(email)
    WHERE email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      AND email <> 'nome@dominio.com'
      AND regexp_replace(split_part(email, '@', 1), '[^a-z0-9_]', '', 'g') <> ALL
        (ARRAY['sememail','naoinformado','naopossui','seuemail','youremail','exemplo','example'])
      AND split_part(email, '@', 2) !~ '(^|\.)example\.(com|net|org)$'
      AND split_part(email, '@', 2) !~ '\.(example|invalid|local|localhost|test)$'
      AND NOT EXISTS (
        SELECT 1 FROM regexp_split_to_table(split_part(email, '@', 2), '\.') AS d(rotulo)
        WHERE rotulo !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
      )
  );
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_tem_email_publico(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_tem_email_publico(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atualizar_uf_prospeccao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.uf_prospeccao := coalesce(public.pharmaleads_uf(NEW.endereco, NEW.local_busca, NEW.dados_brutos), '');
  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION public.atualizar_uf_prospeccao() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_uf_prospeccao() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.pharmaleads_atualizar_email_publico()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.tem_email_publico := public.pharmaleads_tem_email_publico(NEW.emails);
  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_atualizar_email_publico() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_atualizar_email_publico() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.fonte_prospeccao(pharmaleads)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  SELECT CASE coalesce(nullif(trim($1.dados_brutos->>'fonte_dados'), ''), 'Google Maps')
    WHEN 'Google Maps' THEN 'Google Maps'
    WHEN 'Google Meu Negócio' THEN 'Google Meu Negócio'
    WHEN 'Receita Federal' THEN 'Receita Federal'
    ELSE 'Outras fontes'
  END;
$function$
;
REVOKE ALL ON FUNCTION public.fonte_prospeccao(pharmaleads) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fonte_prospeccao(pharmaleads) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.leads_resumo()
 RETURNS TABLE("totalLeads" bigint, qualificados bigint, "emContato" bigint, estados bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET statement_timeout TO '25s'
AS $function$
  SELECT count(*),
    count(*) FILTER (WHERE crm_included IS NOT FALSE AND crm_status = 'Qualificado'),
    count(*) FILTER (WHERE crm_included IS NOT FALSE AND crm_status = 'Em contato'),
    count(DISTINCT uf_prospeccao) FILTER (WHERE uf_prospeccao = ANY(ARRAY[
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']))
  FROM public.pharmaleads;
$function$
;
REVOKE ALL ON FUNCTION public.leads_resumo() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.leads_resumo() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.pharmaleads_email_progresso()
 RETURNS TABLE(indice_pronto boolean, pendente boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH indice AS (
    SELECT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid =
      to_regclass('public.pharmaleads_email_publico_uf_chave_idx') AND indisvalid) AS pronto
  )
  SELECT pronto, CASE WHEN pronto THEN
    EXISTS (SELECT 1 FROM public.pharmaleads WHERE tem_email_publico IS NULL LIMIT 1)
    ELSE true END FROM indice;
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_email_progresso() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_email_progresso() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.pharmaleads_preencher_email_publico()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE atualizados integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.pharmaleads'::regclass
             AND attname = 'tem_email_publico' AND attgenerated = 's') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname IN ('pharmaleads-email-index', 'pharmaleads-email-backfill');
    RETURN 0;
  END IF;
  -- Espera o índice terminar, evitando varrer a tabela em cada lote.
  IF NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid =
      to_regclass('public.pharmaleads_email_publico_uf_chave_idx') AND indisvalid) THEN
    RETURN 0;
  END IF;
  WITH lote AS (
    SELECT chave FROM public.pharmaleads WHERE tem_email_publico IS NULL
    ORDER BY uf_prospeccao, chave LIMIT 2000 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pharmaleads AS p SET tem_email_publico = false
  FROM lote WHERE p.chave = lote.chave; -- O trigger calcula o valor real uma única vez.
  GET DIAGNOSTICS atualizados = ROW_COUNT;
  IF NOT EXISTS (SELECT 1 FROM public.pharmaleads WHERE tem_email_publico IS NULL LIMIT 1) THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname IN ('pharmaleads-email-index', 'pharmaleads-email-backfill');
  END IF;
  RETURN atualizados;
END;
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_preencher_email_publico() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_preencher_email_publico() TO service_role;
CREATE OR REPLACE FUNCTION public.pharmaleads_relatorio()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET statement_timeout TO '25s'
AS $function$
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
$function$
;
REVOKE ALL ON FUNCTION public.pharmaleads_relatorio() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pharmaleads_relatorio() TO authenticated,service_role;
ALTER FUNCTION public.pharmaleads_uf(text,text,jsonb) SET search_path='';
NOTIFY pgrst,'reload schema';
