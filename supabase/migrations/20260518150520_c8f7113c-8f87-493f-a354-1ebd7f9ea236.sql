
-- DOCUMENTS: hierarchical structure
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS owner_member_id uuid;

CREATE INDEX IF NOT EXISTS idx_documents_scope_company ON public.documents(company_id, scope);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);

-- CASES: enriched fields
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS polo_ativo text,
  ADD COLUMN IF NOT EXISTS polo_passivo text,
  ADD COLUMN IF NOT EXISTS lawyer_id uuid,
  ADD COLUMN IF NOT EXISTS internal_number text,
  ADD COLUMN IF NOT EXISTS instance text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS procedural_status text,
  ADD COLUMN IF NOT EXISTS distribution_date date;

-- FINANCIAL ENTRIES: subtype for tabs
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS subtype text NOT NULL DEFAULT 'geral';
-- subtype examples: honorario, parcela, repasse, despesa_fixa, consulta, geral

CREATE INDEX IF NOT EXISTS idx_financial_entries_subtype ON public.financial_entries(company_id, subtype, status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_due ON public.financial_entries(company_id, due_date);
