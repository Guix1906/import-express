
CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('receita','despesa','honorario')),
  category text,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  payment_method text,
  case_id uuid,
  client_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fe_company ON public.financial_entries(company_id);
CREATE INDEX idx_fe_due ON public.financial_entries(company_id, due_date);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view financial_entries" ON public.financial_entries
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create financial_entries" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update financial_entries" ON public.financial_entries
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete financial_entries" ON public.financial_entries
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_fe_updated_at BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
