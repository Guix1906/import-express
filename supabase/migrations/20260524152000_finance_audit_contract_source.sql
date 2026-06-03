-- Finance hardening for premium SaaS behavior:
-- 1) link automatic financial entries to their source contract/action;
-- 2) prevent duplicated installments when a contract activation is retried;
-- 3) restrict sensitive financial rows to owners/admins at RLS level.

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_ref text;

CREATE INDEX IF NOT EXISTS idx_financial_entries_contract
  ON public.financial_entries(company_id, contract_id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_source
  ON public.financial_entries(company_id, source, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_source_ref
  ON public.financial_entries(company_id, source, source_id, source_ref)
  WHERE source IS NOT NULL
    AND source_id IS NOT NULL
    AND source_ref IS NOT NULL;

DROP POLICY IF EXISTS "members can view financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "members can create financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "members can update financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "owners admins delete financial_entries" ON public.financial_entries;

CREATE POLICY "owners admins can view financial_entries" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "owners admins can create financial_entries" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role])
    AND auth.uid() = created_by
  );

CREATE POLICY "owners admins can update financial_entries" ON public.financial_entries
  FOR UPDATE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "owners admins can delete financial_entries" ON public.financial_entries
  FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role,'admin'::app_role]));
