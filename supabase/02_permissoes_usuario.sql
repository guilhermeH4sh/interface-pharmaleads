-- Execute no SQL Editor do projeto. Não apaga os 1.063 leads.
-- Altera somente privilégios/políticas de public.pharmaleads.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid) THEN
    RAISE EXCEPTION 'UID não encontrado em Authentication > Users deste projeto';
  END IF;
END $$;

ALTER TABLE public.pharmaleads ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.pharmaleads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmaleads TO authenticated;

-- A restrição adicional impede que políticas permissivas antigas liberem
-- a tabela a outros usuários autenticados.
DROP POLICY IF EXISTS pharmaleads_uid_restrito ON public.pharmaleads;
CREATE POLICY pharmaleads_uid_restrito ON public.pharmaleads
AS RESTRICTIVE FOR ALL TO public
USING ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid)
WITH CHECK ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid);

DROP POLICY IF EXISTS pharmaleads_leitura ON public.pharmaleads;
CREATE POLICY pharmaleads_leitura ON public.pharmaleads FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid);

DROP POLICY IF EXISTS pharmaleads_insercao ON public.pharmaleads;
CREATE POLICY pharmaleads_insercao ON public.pharmaleads FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid);

DROP POLICY IF EXISTS pharmaleads_atualizacao ON public.pharmaleads;
CREATE POLICY pharmaleads_atualizacao ON public.pharmaleads FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid)
WITH CHECK ((SELECT auth.uid()) = '677ed1e4-3e73-4f2c-951f-e77386f305da'::uuid);

COMMIT;
