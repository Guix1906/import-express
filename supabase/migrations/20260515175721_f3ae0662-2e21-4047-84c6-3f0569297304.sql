CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'honorarios',
  client_id UUID,
  case_id UUID,
  counterparty TEXT,
  value NUMERIC,
  payment_terms TEXT,
  start_date DATE,
  end_date DATE,
  signed_at DATE,
  status TEXT NOT NULL DEFAULT 'rascunho',
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "owners admins update contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "owners admins delete contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_contracts_company ON public.contracts(company_id);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);