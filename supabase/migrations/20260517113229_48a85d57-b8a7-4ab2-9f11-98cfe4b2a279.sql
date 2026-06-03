-- Triagens: novos campos previdenciários
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS practice_area text,
  ADD COLUMN IF NOT EXISTS benefit_type text,
  ADD COLUMN IF NOT EXISTS gov_password text,
  ADD COLUMN IF NOT EXISTS inss_password text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- Clients: campos do cadastro definitivo + flag de provisório
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS city text;

-- Production cards: vinculo com triagem + questionário previdenciário
ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS questionnaire jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_production_cards_triagem ON public.production_cards(triagem_id);
CREATE INDEX IF NOT EXISTS idx_clients_provisional ON public.clients(company_id, is_provisional);