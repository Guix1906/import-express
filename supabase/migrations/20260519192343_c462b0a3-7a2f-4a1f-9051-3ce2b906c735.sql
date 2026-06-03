
CREATE TABLE public.member_board_columns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  owner_user_id uuid not null,
  key text not null,
  title text not null,
  color text not null default 'slate',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id, owner_user_id, key)
);

CREATE INDEX idx_member_board_columns_owner
  ON public.member_board_columns(company_id, owner_user_id, position);

ALTER TABLE public.member_board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view member_board_columns"
  ON public.member_board_columns FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert member_board_columns"
  ON public.member_board_columns FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "members update member_board_columns"
  ON public.member_board_columns FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members delete member_board_columns"
  ON public.member_board_columns FOR DELETE TO authenticated
  USING (is_company_member(auth.uid(), company_id));
