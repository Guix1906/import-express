
-- Expand status enum
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'confirmado';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'aguardando_retorno';
ALTER TYPE public.atendimento_status ADD VALUE IF NOT EXISTS 'nao_compareceu';

-- New columns on atendimentos
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS consultation_type text NOT NULL DEFAULT 'consulta_inicial',
  ADD COLUMN IF NOT EXISTS fee_schedule_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric;

-- Fee schedule table
CREATE TABLE IF NOT EXISTS public.fee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  service_type text NOT NULL,
  description text,
  default_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view fee_schedule" ON public.fee_schedule
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members insert fee_schedule" ON public.fee_schedule
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members update fee_schedule" ON public.fee_schedule
  FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners admins delete fee_schedule" ON public.fee_schedule
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER fee_schedule_touch_updated_at
  BEFORE UPDATE ON public.fee_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
