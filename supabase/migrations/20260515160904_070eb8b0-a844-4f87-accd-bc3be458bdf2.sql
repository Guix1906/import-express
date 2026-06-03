CREATE TABLE public.triagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  raw_description text NOT NULL,
  ai_classification jsonb,
  status text NOT NULL DEFAULT 'novo',
  converted_client_id uuid,
  converted_case_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view triagens"
  ON public.triagens FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create triagens"
  ON public.triagens FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update triagens"
  ON public.triagens FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete triagens"
  ON public.triagens FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER triagens_touch_updated_at
  BEFORE UPDATE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_triagens_company_created ON public.triagens (company_id, created_at DESC);