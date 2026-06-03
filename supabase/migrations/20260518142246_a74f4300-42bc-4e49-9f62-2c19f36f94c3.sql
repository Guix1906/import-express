-- Vínculo contrato -> processo
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS case_id uuid;

CREATE INDEX IF NOT EXISTS idx_contracts_case_id ON public.contracts(case_id);

-- Andamentos processuais
CREATE TABLE IF NOT EXISTS public.process_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  case_id uuid NOT NULL,
  created_by uuid NOT NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_type text NOT NULL DEFAULT 'andamento',
  title text NOT NULL,
  description text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_movements_case ON public.process_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_movements_company ON public.process_movements(company_id, created_at DESC);

ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view process_movements"
  ON public.process_movements FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert process_movements"
  ON public.process_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members update process_movements"
  ON public.process_movements FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete process_movements"
  ON public.process_movements FOR DELETE TO authenticated
  USING (public.has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER trg_process_movements_updated
  BEFORE UPDATE ON public.process_movements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();