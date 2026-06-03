-- Execute this in Supabase SQL Editor when public.documents does not exist.
-- Safe version: it does not reference optional tables such as production_cards,
-- cases or triagens through foreign keys, because some databases may not have
-- those tables yet.

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  client_id uuid,
  case_id uuid,
  card_id uuid,
  triagem_id uuid,
  name text NOT NULL,
  description text,
  category text,
  scope text NOT NULL DEFAULT 'cliente',
  subcategory text,
  owner_member_id uuid,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS card_id uuid,
  ADD COLUMN IF NOT EXISTS triagem_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS owner_member_id uuid,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_documents_company
  ON public.documents(company_id);

CREATE INDEX IF NOT EXISTS idx_documents_client
  ON public.documents(client_id);

CREATE INDEX IF NOT EXISTS idx_documents_case
  ON public.documents(case_id);

CREATE INDEX IF NOT EXISTS idx_documents_card
  ON public.documents(card_id);

CREATE INDEX IF NOT EXISTS idx_documents_triagem
  ON public.documents(company_id, triagem_id)
  WHERE triagem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_scope_company
  ON public.documents(company_id, scope);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Members can view documents" ON public.documents;
DROP POLICY IF EXISTS "Members can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Members can update documents" ON public.documents;
DROP POLICY IF EXISTS "Members can delete documents" ON public.documents;

CREATE POLICY "Members can view documents"
ON public.documents
FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Members can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members can read company documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload company documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can update company documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete company documents" ON storage.objects;
DROP POLICY IF EXISTS "members can view company documents" ON storage.objects;
DROP POLICY IF EXISTS "members can upload company documents" ON storage.objects;
DROP POLICY IF EXISTS "members can delete company documents" ON storage.objects;

CREATE POLICY "Members can read company documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can upload company documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can update company documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can delete company documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

NOTIFY pgrst, 'reload schema';
