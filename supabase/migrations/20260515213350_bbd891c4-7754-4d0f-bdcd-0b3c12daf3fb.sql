-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  response text,
  responded_by uuid,
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id, created_at DESC);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "owners and admins can view company tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "members can create own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = user_id);

CREATE POLICY "owners and admins can update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "owners and admins can delete tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (has_any_company_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();