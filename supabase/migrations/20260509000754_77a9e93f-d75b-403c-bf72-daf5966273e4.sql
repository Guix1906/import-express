ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tasks_status_position_idx ON public.tasks (company_id, status, position);
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks (client_id);