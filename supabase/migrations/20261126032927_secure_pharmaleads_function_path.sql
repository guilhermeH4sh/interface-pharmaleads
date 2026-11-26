-- Mantém a função migrada sem resolução de objetos por schemas mutáveis.
ALTER FUNCTION public.fonte_prospeccao(public.pharmaleads) SET search_path='';
