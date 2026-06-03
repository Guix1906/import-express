-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id uuid,
  name text NOT NULL,
  description text,
  category text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_company ON public.documents(company_id);
CREATE INDEX idx_documents_client ON public.documents(client_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view documents"
ON public.documents FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can insert documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id) AND uploaded_by = auth.uid());

CREATE POLICY "Members can update documents"
ON public.documents FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Owners/admins can delete documents"
ON public.documents FOR DELETE TO authenticated
USING (public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path is "<company_id>/<uuid>-<filename>"
CREATE POLICY "Members can read company documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can upload company documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can update company documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Owners/admins can delete company documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_any_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner','admin']::app_role[])
);