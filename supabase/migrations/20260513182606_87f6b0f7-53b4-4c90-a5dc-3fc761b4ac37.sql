ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS is_double_term boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_alert_level text;

CREATE INDEX IF NOT EXISTS idx_deadlines_due_date_status
  ON public.deadlines (company_id, status, due_date);