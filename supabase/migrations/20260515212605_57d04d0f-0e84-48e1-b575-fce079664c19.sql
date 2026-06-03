
CREATE TYPE public.atendimento_status AS ENUM ('agendado', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.atendimento_channel AS ENUM ('presencial', 'video', 'telefone', 'whatsapp', 'email');

CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  assigned_to UUID,
  subject TEXT NOT NULL,
  summary TEXT,
  channel public.atendimento_channel NOT NULL DEFAULT 'presencial',
  status public.atendimento_status NOT NULL DEFAULT 'agendado',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  billable BOOLEAN NOT NULL DEFAULT false,
  hourly_rate NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_company ON public.atendimentos(company_id);
CREATE INDEX idx_atendimentos_client ON public.atendimentos(client_id);
CREATE INDEX idx_atendimentos_case ON public.atendimentos(case_id);
CREATE INDEX idx_atendimentos_scheduled ON public.atendimentos(scheduled_at);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view atendimentos"
  ON public.atendimentos FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can insert atendimentos"
  ON public.atendimentos FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());

CREATE POLICY "members can update atendimentos"
  ON public.atendimentos FOR UPDATE
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can delete atendimentos"
  ON public.atendimentos FOR DELETE
  USING (public.is_company_member(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.set_atendimentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_atendimentos_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_atendimentos_updated_at();
