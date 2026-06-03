-- RUN THIS FILE IN SUPABASE SQL EDITOR.
-- Safe incremental core tables for the real office flow:
-- Clientes -> Processos -> Contratos -> Financeiro -> Producao -> Agenda -> Auditoria.
-- No DO, IF, EXECUTE, or foreign keys, so it can run even when the database is partial.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  client_type text NOT NULL DEFAULT 'individual',
  document text,
  email text,
  phone text,
  whatsapp text,
  address text,
  city text,
  state text,
  rg text,
  birth_date date,
  marital_status text,
  profession text,
  origin text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  photo_url text,
  is_provisional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS is_provisional boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_clients_company_created ON public.clients(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_company_document ON public.clients(company_id, document);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Members can delete clients" ON public.clients;
CREATE POLICY "Members can view clients" ON public.clients FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert clients" ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update clients" ON public.clients FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete clients" ON public.clients FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CASES / PROCESSES
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  client_id uuid,
  contract_id uuid,
  triagem_id uuid,
  title text NOT NULL,
  cnj_number text,
  internal_number text,
  practice_area text,
  court text,
  vara text,
  comarca text,
  tribunal text,
  instance text,
  case_value numeric,
  polo_ativo text,
  polo_passivo text,
  opposing_party text,
  priority text DEFAULT 'media',
  procedural_status text,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  phase text,
  assigned_to uuid,
  lawyer_id uuid,
  distribution_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS cnj_number text,
  ADD COLUMN IF NOT EXISTS internal_number text,
  ADD COLUMN IF NOT EXISTS practice_area text,
  ADD COLUMN IF NOT EXISTS court text,
  ADD COLUMN IF NOT EXISTS vara text,
  ADD COLUMN IF NOT EXISTS comarca text,
  ADD COLUMN IF NOT EXISTS tribunal text,
  ADD COLUMN IF NOT EXISTS instance text,
  ADD COLUMN IF NOT EXISTS case_value numeric,
  ADD COLUMN IF NOT EXISTS polo_ativo text,
  ADD COLUMN IF NOT EXISTS polo_passivo text,
  ADD COLUMN IF NOT EXISTS opposing_party text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS procedural_status text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS lawyer_id uuid,
  ADD COLUMN IF NOT EXISTS distribution_date date,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_cases_company_created ON public.cases(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_client ON public.cases(company_id, client_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON public.cases(company_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_cnj ON public.cases(company_id, cnj_number);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view cases" ON public.cases;
DROP POLICY IF EXISTS "Members can insert cases" ON public.cases;
DROP POLICY IF EXISTS "Members can update cases" ON public.cases;
DROP POLICY IF EXISTS "Members can delete cases" ON public.cases;
CREATE POLICY "Members can view cases" ON public.cases FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert cases" ON public.cases FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update cases" ON public.cases FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete cases" ON public.cases FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_cases_updated_at ON public.cases;
CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CONTRACTS
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  triagem_id uuid,
  title text NOT NULL,
  contract_type text NOT NULL DEFAULT 'honorarios',
  counterparty text,
  value numeric,
  payment_terms text,
  payment_method text,
  start_date date,
  end_date date,
  signed_at date,
  activated_at timestamptz,
  status text NOT NULL DEFAULT 'rascunho',
  file_url text,
  final_document_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'honorarios',
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS value numeric,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS signed_at date,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS final_document_id uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_contracts_company_created ON public.contracts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.contracts(company_id, client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_case ON public.contracts(company_id, case_id);
CREATE INDEX IF NOT EXISTS idx_contracts_triagem ON public.contracts(company_id, triagem_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Members can delete contracts" ON public.contracts;
CREATE POLICY "Members can view contracts" ON public.contracts FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert contracts" ON public.contracts FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update contracts" ON public.contracts FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete contracts" ON public.contracts FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- FINANCIAL ENTRIES
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  contract_id uuid,
  entry_type text NOT NULL DEFAULT 'receita',
  subtype text NOT NULL DEFAULT 'geral',
  category text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pendente',
  payment_method text,
  notes text,
  source text,
  source_id uuid,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'receita',
  ADD COLUMN IF NOT EXISTS subtype text DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_financial_entries_company_due ON public.financial_entries(company_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status ON public.financial_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_client ON public.financial_entries(company_id, client_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_contract ON public.financial_entries(company_id, contract_id);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Members can insert financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Members can update financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Members can delete financial_entries" ON public.financial_entries;
CREATE POLICY "Members can view financial_entries" ON public.financial_entries FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert financial_entries" ON public.financial_entries FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update financial_entries" ON public.financial_entries FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete financial_entries" ON public.financial_entries FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_financial_entries_updated_at ON public.financial_entries;
CREATE TRIGGER trg_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PRODUCTION CARDS
CREATE TABLE IF NOT EXISTS public.production_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid,
  assignee_id uuid,
  created_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  triagem_id uuid,
  client_name_snapshot text,
  process_number text,
  questionnaire jsonb NOT NULL DEFAULT '{}'::jsonb,
  practice_area text,
  demand_type text,
  category text,
  department text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media',
  column_key text NOT NULL DEFAULT 'para_producao',
  legal_phase text NOT NULL DEFAULT 'triagem',
  operational_status text NOT NULL DEFAULT 'aguardando_documentos',
  legal_phase_changed_at timestamptz NOT NULL DEFAULT now(),
  operational_status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_date timestamptz,
  sla_hours integer,
  started_at timestamptz,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_cards
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS board_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS client_name_snapshot text,
  ADD COLUMN IF NOT EXISTS process_number text,
  ADD COLUMN IF NOT EXISTS questionnaire jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS practice_area text,
  ADD COLUMN IF NOT EXISTS demand_type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS column_key text DEFAULT 'para_producao',
  ADD COLUMN IF NOT EXISTS legal_phase text DEFAULT 'triagem',
  ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'aguardando_documentos',
  ADD COLUMN IF NOT EXISTS legal_phase_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS operational_status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_flags jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS sla_hours integer,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_production_cards_company ON public.production_cards(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_cards_board ON public.production_cards(company_id, board_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_assignee ON public.production_cards(company_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_column ON public.production_cards(company_id, column_key, position);
CREATE INDEX IF NOT EXISTS idx_production_cards_op_status ON public.production_cards(company_id, operational_status);
CREATE INDEX IF NOT EXISTS idx_production_cards_client ON public.production_cards(company_id, client_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_case ON public.production_cards(company_id, case_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_triagem ON public.production_cards(company_id, triagem_id);

ALTER TABLE public.production_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view production_cards" ON public.production_cards;
DROP POLICY IF EXISTS "Members can insert production_cards" ON public.production_cards;
DROP POLICY IF EXISTS "Members can update production_cards" ON public.production_cards;
DROP POLICY IF EXISTS "Members can delete production_cards" ON public.production_cards;
CREATE POLICY "Members can view production_cards" ON public.production_cards FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert production_cards" ON public.production_cards FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update production_cards" ON public.production_cards FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete production_cards" ON public.production_cards FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_production_cards_updated_at ON public.production_cards;
CREATE TRIGGER trg_production_cards_updated_at BEFORE UPDATE ON public.production_cards
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PRODUCTION CARD DETAILS
CREATE TABLE IF NOT EXISTS public.production_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_card_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_card_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pce_card ON public.production_card_events(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcc_card ON public.production_card_comments(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pck_card ON public.production_card_checklist(card_id, position);
CREATE INDEX IF NOT EXISTS idx_pcw_card ON public.production_card_watchers(card_id, profile_id);

ALTER TABLE public.production_card_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_card_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_card_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view production_card_events" ON public.production_card_events;
DROP POLICY IF EXISTS "Members can insert production_card_events" ON public.production_card_events;
CREATE POLICY "Members can view production_card_events" ON public.production_card_events FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert production_card_events" ON public.production_card_events FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view production_card_comments" ON public.production_card_comments;
DROP POLICY IF EXISTS "Members can insert production_card_comments" ON public.production_card_comments;
DROP POLICY IF EXISTS "Members can update production_card_comments" ON public.production_card_comments;
DROP POLICY IF EXISTS "Members can delete production_card_comments" ON public.production_card_comments;
CREATE POLICY "Members can view production_card_comments" ON public.production_card_comments FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert production_card_comments" ON public.production_card_comments FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update production_card_comments" ON public.production_card_comments FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete production_card_comments" ON public.production_card_comments FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view production_card_checklist" ON public.production_card_checklist;
DROP POLICY IF EXISTS "Members can insert production_card_checklist" ON public.production_card_checklist;
DROP POLICY IF EXISTS "Members can update production_card_checklist" ON public.production_card_checklist;
DROP POLICY IF EXISTS "Members can delete production_card_checklist" ON public.production_card_checklist;
CREATE POLICY "Members can view production_card_checklist" ON public.production_card_checklist FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert production_card_checklist" ON public.production_card_checklist FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update production_card_checklist" ON public.production_card_checklist FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete production_card_checklist" ON public.production_card_checklist FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view production_card_watchers" ON public.production_card_watchers;
DROP POLICY IF EXISTS "Members can insert production_card_watchers" ON public.production_card_watchers;
DROP POLICY IF EXISTS "Members can delete production_card_watchers" ON public.production_card_watchers;
CREATE POLICY "Members can view production_card_watchers" ON public.production_card_watchers FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert production_card_watchers" ON public.production_card_watchers FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete production_card_watchers" ON public.production_card_watchers FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_production_card_comments_updated_at ON public.production_card_comments;
CREATE TRIGGER trg_production_card_comments_updated_at BEFORE UPDATE ON public.production_card_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CUSTOM BOARDS
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  board_type text NOT NULL DEFAULT 'advogado',
  color text NOT NULL DEFAULT 'blue',
  gradient text,
  icon text,
  owner_id uuid,
  role_label text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL,
  key text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  key text NOT NULL,
  title text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS board_type text DEFAULT 'advogado',
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS gradient text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.board_columns
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS board_id uuid,
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.board_members
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS board_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.member_board_columns
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'slate',
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_boards_company ON public.boards(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_columns_board ON public.board_columns(board_id, position);
CREATE INDEX IF NOT EXISTS idx_board_members_board ON public.board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON public.board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_member_board_columns_owner ON public.member_board_columns(company_id, owner_user_id, position);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view boards" ON public.boards;
DROP POLICY IF EXISTS "Members can insert boards" ON public.boards;
DROP POLICY IF EXISTS "Members can update boards" ON public.boards;
DROP POLICY IF EXISTS "Members can delete boards" ON public.boards;
CREATE POLICY "Members can view boards" ON public.boards FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert boards" ON public.boards FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update boards" ON public.boards FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete boards" ON public.boards FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view board_columns" ON public.board_columns;
DROP POLICY IF EXISTS "Members can insert board_columns" ON public.board_columns;
DROP POLICY IF EXISTS "Members can update board_columns" ON public.board_columns;
DROP POLICY IF EXISTS "Members can delete board_columns" ON public.board_columns;
CREATE POLICY "Members can view board_columns" ON public.board_columns FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert board_columns" ON public.board_columns FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update board_columns" ON public.board_columns FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete board_columns" ON public.board_columns FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view board_members" ON public.board_members;
DROP POLICY IF EXISTS "Members can insert board_members" ON public.board_members;
DROP POLICY IF EXISTS "Members can delete board_members" ON public.board_members;
CREATE POLICY "Members can view board_members" ON public.board_members FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert board_members" ON public.board_members FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete board_members" ON public.board_members FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view member_board_columns" ON public.member_board_columns;
DROP POLICY IF EXISTS "Members can insert member_board_columns" ON public.member_board_columns;
DROP POLICY IF EXISTS "Members can update member_board_columns" ON public.member_board_columns;
DROP POLICY IF EXISTS "Members can delete member_board_columns" ON public.member_board_columns;
CREATE POLICY "Members can view member_board_columns" ON public.member_board_columns FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert member_board_columns" ON public.member_board_columns FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update member_board_columns" ON public.member_board_columns FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete member_board_columns" ON public.member_board_columns FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_boards_updated_at ON public.boards;
CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AGENDA: TASKS, DEADLINES AND EVENTS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  case_id uuid,
  client_id uuid,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  case_id uuid,
  client_id uuid,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  is_double_term boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  case_id uuid,
  client_id uuid,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'meeting',
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text DEFAULT 'scheduled',
  reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_double_term boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'meeting',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tasks_company_due ON public.tasks(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(company_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_deadlines_company_due ON public.deadlines(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_assigned ON public.deadlines(company_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_events_company_starts ON public.events(company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_assigned ON public.events(company_id, assigned_to);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can delete tasks" ON public.tasks;
CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Members can insert deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Members can update deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Members can delete deadlines" ON public.deadlines;
CREATE POLICY "Members can view deadlines" ON public.deadlines FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert deadlines" ON public.deadlines FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update deadlines" ON public.deadlines FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete deadlines" ON public.deadlines FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "Members can view events" ON public.events;
DROP POLICY IF EXISTS "Members can insert events" ON public.events;
DROP POLICY IF EXISTS "Members can update events" ON public.events;
DROP POLICY IF EXISTS "Members can delete events" ON public.events;
CREATE POLICY "Members can view events" ON public.events FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert events" ON public.events FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update events" ON public.events FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete events" ON public.events FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_deadlines_updated_at ON public.deadlines;
CREATE TRIGGER trg_deadlines_updated_at BEFORE UPDATE ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ACTIVITY LOGS / AUDIT
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  description text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS entity_label text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created ON public.activity_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Members can insert activity_logs" ON public.activity_logs;
CREATE POLICY "Members can view activity_logs" ON public.activity_logs FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- PROCESS MOVEMENTS
CREATE TABLE IF NOT EXISTS public.process_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  case_id uuid NOT NULL,
  created_by uuid NOT NULL,
  movement_date date NOT NULL DEFAULT current_date,
  movement_type text NOT NULL DEFAULT 'andamento',
  title text NOT NULL,
  description text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_movements
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS movement_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS movement_type text DEFAULT 'andamento',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_process_movements_case ON public.process_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_movements_company ON public.process_movements(company_id, created_at DESC);

ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view process_movements" ON public.process_movements;
DROP POLICY IF EXISTS "Members can insert process_movements" ON public.process_movements;
DROP POLICY IF EXISTS "Members can update process_movements" ON public.process_movements;
DROP POLICY IF EXISTS "Members can delete process_movements" ON public.process_movements;
CREATE POLICY "Members can view process_movements" ON public.process_movements FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert process_movements" ON public.process_movements FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update process_movements" ON public.process_movements FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete process_movements" ON public.process_movements FOR DELETE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
DROP TRIGGER IF EXISTS trg_process_movements_updated_at ON public.process_movements;
CREATE TRIGGER trg_process_movements_updated_at BEFORE UPDATE ON public.process_movements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CARD PHASE HISTORY
CREATE TABLE IF NOT EXISTS public.card_phase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  track text NOT NULL,
  from_value text,
  to_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.card_phase_history
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS card_id uuid,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS track text,
  ADD COLUMN IF NOT EXISTS from_value text,
  ADD COLUMN IF NOT EXISTS to_value text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_card_phase_history_card ON public.card_phase_history(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_phase_history_company ON public.card_phase_history(company_id, created_at DESC);

ALTER TABLE public.card_phase_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view card_phase_history" ON public.card_phase_history;
DROP POLICY IF EXISTS "Members can insert card_phase_history" ON public.card_phase_history;
CREATE POLICY "Members can view card_phase_history" ON public.card_phase_history FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert card_phase_history" ON public.card_phase_history FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Members can insert notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Members can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NULL
  OR public.is_company_member(auth.uid(), company_id)
);

NOTIFY pgrst, 'reload schema';
