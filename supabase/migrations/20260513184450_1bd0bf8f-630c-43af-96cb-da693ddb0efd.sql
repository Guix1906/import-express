
-- 1) assigned_to em publications
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE INDEX IF NOT EXISTS publications_assigned_to_idx
  ON public.publications(assigned_to);

-- 2) tabela de comentários internos
CREATE TABLE IF NOT EXISTS public.publication_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  publication_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publication_comments_pub_idx
  ON public.publication_comments(publication_id, created_at DESC);

ALTER TABLE public.publication_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view publication comments"
  ON public.publication_comments
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create publication comments"
  ON public.publication_comments
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = author_id);

CREATE POLICY "authors can update own comments"
  ON public.publication_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "authors or admins can delete comments"
  ON public.publication_comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role])
  );

CREATE TRIGGER publication_comments_updated_at
  BEFORE UPDATE ON public.publication_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) realtime para comentários
ALTER PUBLICATION supabase_realtime ADD TABLE public.publication_comments;
