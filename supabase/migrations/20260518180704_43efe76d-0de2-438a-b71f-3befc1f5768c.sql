-- Performance indexes on hot filter columns
CREATE INDEX IF NOT EXISTS idx_production_cards_company ON public.production_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_assignee ON public.production_cards(assignee_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_client ON public.production_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_case ON public.production_cards(case_id);
CREATE INDEX IF NOT EXISTS idx_production_cards_updated ON public.production_cards(company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_cards_due ON public.production_cards(due_date);

CREATE INDEX IF NOT EXISTS idx_atendimentos_company ON public.atendimentos(company_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_client ON public.atendimentos(client_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_case ON public.atendimentos(case_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_assigned ON public.atendimentos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_atendimentos_scheduled ON public.atendimentos(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON public.atendimentos(company_id, status);

CREATE INDEX IF NOT EXISTS idx_cases_company ON public.cases(company_id);
CREATE INDEX IF NOT EXISTS idx_cases_client ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON public.cases(assigned_to);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(company_id, name);

CREATE INDEX IF NOT EXISTS idx_tasks_company ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_deadlines_company ON public.deadlines(company_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_case ON public.deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_assigned ON public.deadlines(assigned_to);

CREATE INDEX IF NOT EXISTS idx_events_company ON public.events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_starts ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_assigned ON public.events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_events_case ON public.events(case_id);

CREATE INDEX IF NOT EXISTS idx_financial_company ON public.financial_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_due ON public.financial_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_status ON public.financial_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_client ON public.financial_entries(client_id);

CREATE INDEX IF NOT EXISTS idx_publications_company ON public.publications(company_id);
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications(company_id, status);
CREATE INDEX IF NOT EXISTS idx_publications_assigned ON public.publications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_publications_case ON public.publications(case_id);

CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_card ON public.documents(card_id);

CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_case ON public.contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_contracts_signed ON public.contracts(company_id, signed_at);

CREATE INDEX IF NOT EXISTS idx_triagens_company ON public.triagens(company_id);
CREATE INDEX IF NOT EXISTS idx_triagens_status ON public.triagens(company_id, status);
CREATE INDEX IF NOT EXISTS idx_triagens_assigned ON public.triagens(assigned_to);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_card_phase_history_card ON public.card_phase_history(card_id);
CREATE INDEX IF NOT EXISTS idx_card_phase_history_company ON public.card_phase_history(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_process_movements_case ON public.process_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_process_movements_company ON public.process_movements(company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON public.user_roles(user_id, company_id, role);

-- Make client-photos bucket private (still accessible via signed URLs)
UPDATE storage.buckets SET public = false WHERE id = 'client-photos';

-- Storage policies for client-photos (members of company can read/write)
DROP POLICY IF EXISTS "client photos read" ON storage.objects;
DROP POLICY IF EXISTS "client photos write" ON storage.objects;
DROP POLICY IF EXISTS "client photos update" ON storage.objects;
DROP POLICY IF EXISTS "client photos delete" ON storage.objects;

CREATE POLICY "client photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-photos');

CREATE POLICY "client photos write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-photos');

CREATE POLICY "client photos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-photos');

CREATE POLICY "client photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-photos');