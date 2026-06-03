-- Premium triage flow: normalized status, lawyer assignment, conversion links and auditability.
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS demand_type text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS secretary_notes text,
  ADD COLUMN IF NOT EXISTS lawyer_notes text,
  ADD COLUMN IF NOT EXISTS legal_analysis text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_contract_id uuid,
  ADD COLUMN IF NOT EXISTS converted_card_id uuid;

UPDATE public.triagens
SET
  assigned_lawyer_id = COALESCE(assigned_lawyer_id, assigned_to),
  client_id = COALESCE(client_id, converted_client_id),
  document = COALESCE(document, cpf),
  demand_type = COALESCE(demand_type, benefit_type),
  secretary_notes = COALESCE(secretary_notes, observations),
  status = CASE status
    WHEN 'novo' THEN 'waiting_lawyer'
    WHEN 'classificado' THEN 'waiting_lawyer'
    WHEN 'em_atendimento' THEN 'in_attendance'
    WHEN 'convertido' THEN 'converted'
    WHEN 'recusado' THEN 'archived'
    ELSE status
  END
WHERE status IN ('novo', 'classificado', 'em_atendimento', 'convertido', 'recusado')
   OR assigned_lawyer_id IS NULL
   OR client_id IS NULL
   OR document IS NULL
   OR demand_type IS NULL
   OR secretary_notes IS NULL;

ALTER TABLE public.triagens
  DROP CONSTRAINT IF EXISTS triagens_status_check,
  ADD CONSTRAINT triagens_status_check
    CHECK (status IN ('draft', 'waiting_lawyer', 'in_attendance', 'waiting_documents', 'converted', 'archived')),
  DROP CONSTRAINT IF EXISTS triagens_priority_check,
  ADD CONSTRAINT triagens_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_triagens_company_status_created
  ON public.triagens(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triagens_assigned_lawyer_status
  ON public.triagens(company_id, assigned_lawyer_id, status, created_at DESC)
  WHERE assigned_lawyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_triagens_client
  ON public.triagens(company_id, client_id)
  WHERE client_id IS NOT NULL;

DROP POLICY IF EXISTS "members can view triagens" ON public.triagens;
CREATE POLICY "members can view triagens"
  ON public.triagens FOR SELECT TO authenticated
  USING (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin','assistant']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "members can update triagens" ON public.triagens;
CREATE POLICY "members can update triagens"
  ON public.triagens FOR UPDATE TO authenticated
  USING (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_any_company_role(auth.uid(), company_id, ARRAY['owner','admin']::public.app_role[])
    OR assigned_lawyer_id = auth.uid()
    OR created_by = auth.uid()
  );
