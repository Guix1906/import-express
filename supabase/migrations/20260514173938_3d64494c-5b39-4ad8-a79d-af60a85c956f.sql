-- Tabela de processos monitorados via DataJud
CREATE TABLE public.monitored_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  cnj_number text NOT NULL,
  tribunal_alias text NOT NULL,
  label text,
  client_id uuid,
  case_id uuid,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_movement_date date,
  movements_count integer NOT NULL DEFAULT 0,
  classe text,
  assunto text,
  orgao_julgador text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cnj_number)
);

CREATE INDEX idx_monitored_processes_company ON public.monitored_processes(company_id);
CREATE INDEX idx_monitored_processes_active ON public.monitored_processes(active) WHERE active = true;

ALTER TABLE public.monitored_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view monitored processes"
  ON public.monitored_processes FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create monitored processes"
  ON public.monitored_processes FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update monitored processes"
  ON public.monitored_processes FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete monitored processes"
  ON public.monitored_processes FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER touch_monitored_processes
  BEFORE UPDATE ON public.monitored_processes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Adicionar coluna para vincular publicação ao processo monitorado
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS monitored_process_id uuid;

CREATE INDEX IF NOT EXISTS idx_publications_monitored_process
  ON public.publications(monitored_process_id);