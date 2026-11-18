-- Permite que a contagem exata termine sem alterar o limite das demais consultas.
ALTER FUNCTION public.leads_resumo() SET statement_timeout TO '25s';
NOTIFY pgrst, 'reload schema';
