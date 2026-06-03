DROP TABLE IF EXISTS public.publication_sync_logs CASCADE;
DROP TABLE IF EXISTS public.monitored_processes CASCADE;
DROP TABLE IF EXISTS public.oab_monitors CASCADE;

ALTER TABLE public.publications
  DROP COLUMN IF EXISTS monitored_process_id,
  DROP COLUMN IF EXISTS external_id,
  DROP COLUMN IF EXISTS source;