CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_company_created ON public.activity_logs (company_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view activity_logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "members can insert activity_logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id) AND user_id = auth.uid());
