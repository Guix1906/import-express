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

UPDATE public.triagens
SET status = 'attendance_finished'
WHERE status = 'in_attendance'
  AND finished_at IS NOT NULL;
