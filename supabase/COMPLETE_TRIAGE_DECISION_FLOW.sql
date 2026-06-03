ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS legal_viability text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS pending_documents text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS attendance_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

ALTER TABLE public.triagens
  DROP CONSTRAINT IF EXISTS triagens_status_check;

ALTER TABLE public.triagens
  ADD CONSTRAINT triagens_status_check
    CHECK (
      status IN (
        'draft',
        'waiting_lawyer',
        'in_attendance',
        'attendance_finished',
        'waiting_documents',
        'converted',
        'archived'
      )
    );

CREATE INDEX IF NOT EXISTS idx_triagens_company_status_created
  ON public.triagens(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triagens_company_assigned
  ON public.triagens(company_id, assigned_to, created_at DESC);
