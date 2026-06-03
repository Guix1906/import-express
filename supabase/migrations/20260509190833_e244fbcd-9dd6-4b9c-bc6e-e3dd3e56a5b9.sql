-- Lock down SECURITY DEFINER helper functions: only the database itself (used inside policies) should call them.
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_company_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_company_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;

-- Performance indexes for the most common task queries (dashboard list, kanban, activities)
CREATE INDEX IF NOT EXISTS idx_tasks_company_created_at ON public.tasks (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_company_status     ON public.tasks (company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date           ON public.tasks (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to        ON public.tasks (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_company_starts_at ON public.events (company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cases_company_id         ON public.cases (company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id       ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user     ON public.company_members (user_id);