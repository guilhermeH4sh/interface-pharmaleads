-- Colunas para dados oficiais do Google Business Profile (Places API)
-- Executar no Supabase: SQL Editor > New query > Run
ALTER TABLE pharmaleads
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_reviews integer,
  ADD COLUMN IF NOT EXISTS google_status text,
  ADD COLUMN IF NOT EXISTS google_maps_url text;
