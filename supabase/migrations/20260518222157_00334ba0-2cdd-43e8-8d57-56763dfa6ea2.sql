-- BOARDS
CREATE TABLE public.boards (
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

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view boards" ON public.boards
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members create boards" ON public.boards
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "creator or admins update boards" ON public.boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "creator or admins delete boards" ON public.boards
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER touch_boards_updated_at BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_boards_company ON public.boards(company_id);

-- BOARD COLUMNS
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view board_columns" ON public.board_columns
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert board_columns" ON public.board_columns
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members update board_columns" ON public.board_columns
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete board_columns" ON public.board_columns
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE INDEX idx_board_columns_board ON public.board_columns(board_id);

-- BOARD MEMBERS
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view board_members" ON public.board_members
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "members insert board_members" ON public.board_members
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "members delete board_members" ON public.board_members
  FOR DELETE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE INDEX idx_board_members_board ON public.board_members(board_id);

-- LINK PRODUCTION CARDS TO BOARDS
ALTER TABLE public.production_cards ADD COLUMN board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL;
CREATE INDEX idx_production_cards_board ON public.production_cards(board_id);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_members;