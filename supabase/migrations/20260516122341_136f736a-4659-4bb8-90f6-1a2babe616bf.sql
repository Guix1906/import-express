
-- ============ TABELA PRINCIPAL: production_cards ============
CREATE TABLE public.production_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  assignee_id uuid NOT NULL,
  created_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  client_name_snapshot text,
  process_number text,
  practice_area text,
  demand_type text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  column_key text NOT NULL DEFAULT 'para_producao' CHECK (column_key IN (
    'para_producao','para_protocolo_judicial','protocolados_adm','intermediarias',
    'arquivados','concluidos','em_revisao','pendencias'
  )),
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

CREATE INDEX idx_pc_company ON public.production_cards(company_id);
CREATE INDEX idx_pc_assignee ON public.production_cards(assignee_id);
CREATE INDEX idx_pc_column ON public.production_cards(company_id, assignee_id, column_key, position);
CREATE INDEX idx_pc_client ON public.production_cards(client_id);
CREATE INDEX idx_pc_case ON public.production_cards(case_id);

ALTER TABLE public.production_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_cards" ON public.production_cards
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_cards" ON public.production_cards
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);
CREATE POLICY "members can update production_cards" ON public.production_cards
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "owners admins delete production_cards" ON public.production_cards
  FOR DELETE TO authenticated USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON public.production_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EVENTOS / TIMELINE ============
CREATE TABLE public.production_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pce_card ON public.production_card_events(card_id, created_at DESC);
ALTER TABLE public.production_card_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_card_events" ON public.production_card_events
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_card_events" ON public.production_card_events
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = actor_id);

-- ============ COMENTÁRIOS ============
CREATE TABLE public.production_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcc_card ON public.production_card_comments(card_id, created_at DESC);
ALTER TABLE public.production_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view production_card_comments" ON public.production_card_comments
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members can create production_card_comments" ON public.production_card_comments
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = author_id);
CREATE POLICY "authors update own comments" ON public.production_card_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "authors or admins delete comments" ON public.production_card_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_pcc_updated_at BEFORE UPDATE ON public.production_card_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CHECKLIST ============
CREATE TABLE public.production_card_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pck_card ON public.production_card_checklist(card_id, position);
ALTER TABLE public.production_card_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist" ON public.production_card_checklist
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert checklist" ON public.production_card_checklist
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members update checklist" ON public.production_card_checklist
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete checklist" ON public.production_card_checklist
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

-- ============ WATCHERS ============
CREATE TABLE public.production_card_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, profile_id)
);
ALTER TABLE public.production_card_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view watchers" ON public.production_card_watchers
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert watchers" ON public.production_card_watchers
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete watchers" ON public.production_card_watchers
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

-- ============ DOCUMENTS: vínculo com card ============
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS card_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_card_id ON public.documents(card_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_events;
ALTER TABLE public.production_cards REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_events REPLICA IDENTITY FULL;
