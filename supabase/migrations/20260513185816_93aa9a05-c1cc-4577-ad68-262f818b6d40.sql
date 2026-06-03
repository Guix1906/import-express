
-- 1) OABs monitoradas
CREATE TABLE IF NOT EXISTS public.oab_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  oab_number text NOT NULL,
  oab_state text NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, oab_number, oab_state)
);

CREATE INDEX IF NOT EXISTS oab_monitors_company_idx
  ON public.oab_monitors(company_id);

ALTER TABLE public.oab_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view oab monitors"
  ON public.oab_monitors FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "members can create oab monitors"
  ON public.oab_monitors FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = created_by);

CREATE POLICY "members can update oab monitors"
  ON public.oab_monitors FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "owners and admins can delete oab monitors"
  ON public.oab_monitors FOR DELETE TO authenticated
  USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER oab_monitors_updated_at
  BEFORE UPDATE ON public.oab_monitors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Histórico de sincronizações
CREATE TABLE IF NOT EXISTS public.publication_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',
  oab_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS publication_sync_logs_company_idx
  ON public.publication_sync_logs(company_id, started_at DESC);

ALTER TABLE public.publication_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view sync logs"
  ON public.publication_sync_logs FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

-- inserts são feitos pelo server (service role bypassa RLS)

-- 3) Notificações in-app
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- inserts feitos pelo server (service role)

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publication_sync_logs;
