-- Aplicar somente no projeto dedicado, após copiar e comparar todas as colunas.
SET lock_timeout='3s';
SET statement_timeout='25s';
REVOKE ALL ON public.pharmaleads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.pharmaleads TO authenticated;
ALTER TABLE public.pharmaleads SET (autovacuum_vacuum_scale_factor=0.02, autovacuum_analyze_scale_factor=0.01);
CREATE INDEX pharmaleads_uf_prospeccao_chave_idx ON public.pharmaleads USING btree (uf_prospeccao, chave);
CREATE INDEX pharmaleads_whatsapp_verificacao_idx ON public.pharmaleads USING btree (((whatsapp_verificacao ->> 'estado'::text)), chave) WHERE (whatsapp_verificacao IS NOT NULL);
CREATE INDEX pharmaleads_crm_ativos_chave ON public.pharmaleads USING btree (chave) WHERE ((crm_included = true) OR ((crm_included IS NULL) AND (crm_status <> 'Não contatado'::text)));
CREATE INDEX pharmaleads_email_publico_uf_chave_idx ON public.pharmaleads USING btree (tem_email_publico, uf_prospeccao, chave) INCLUDE (crm_included, crm_status, segmento);
CREATE TRIGGER pharmaleads_atualizar_email_publico BEFORE INSERT OR UPDATE OF emails, tem_email_publico ON public.pharmaleads FOR EACH ROW EXECUTE FUNCTION pharmaleads_atualizar_email_publico();
CREATE TRIGGER pharmaleads_atualizar_uf_prospeccao BEFORE INSERT OR UPDATE OF endereco, local_busca, dados_brutos, uf_prospeccao ON public.pharmaleads FOR EACH ROW EXECUTE FUNCTION atualizar_uf_prospeccao();
ANALYZE public.pharmaleads;
NOTIFY pgrst,'reload schema';
