
-- 1) Create credentials table
CREATE TABLE public.triagem_credentials (
  triagem_id uuid PRIMARY KEY REFERENCES public.triagens(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  created_by uuid,
  gov_password text,
  inss_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triagem_credentials_company ON public.triagem_credentials(company_id);

-- 2) Backfill from existing triagens
INSERT INTO public.triagem_credentials (triagem_id, company_id, created_by, gov_password, inss_password)
SELECT t.id, t.company_id, t.created_by, t.gov_password, t.inss_password
FROM public.triagens t
WHERE t.gov_password IS NOT NULL OR t.inss_password IS NOT NULL;

-- 3) Drop sensitive columns from triagens
ALTER TABLE public.triagens DROP COLUMN gov_password;
ALTER TABLE public.triagens DROP COLUMN inss_password;

-- 4) Enable RLS
ALTER TABLE public.triagem_credentials ENABLE ROW LEVEL SECURITY;

-- 5) Helper: caller is owner/admin or the creator of the triagem
CREATE POLICY "triagem_credentials_select_restricted"
ON public.triagem_credentials FOR SELECT
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_insert_restricted"
ON public.triagem_credentials FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_update_restricted"
ON public.triagem_credentials FOR UPDATE
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY "triagem_credentials_delete_restricted"
ON public.triagem_credentials FOR DELETE
TO authenticated
USING (
  public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[])
);

-- 6) Updated_at trigger
CREATE TRIGGER trg_triagem_credentials_updated_at
BEFORE UPDATE ON public.triagem_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
