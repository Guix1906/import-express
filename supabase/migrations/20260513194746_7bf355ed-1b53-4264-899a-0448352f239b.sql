-- Reagenda cron jobs para passar o apikey header (publishable key)
-- exigido pelos hooks /api/public/hooks/* após hardening de segurança.

DO $$
DECLARE
  v_apikey TEXT := 'REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY';
  v_base TEXT := 'https://project--9f1f5e48-03fc-4442-907a-a1a9a18cd0b8.lovable.app';
  v_headers JSONB;
BEGIN
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_apikey
  );

  -- Remove agendamentos antigos (sem apikey) se existirem
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'jusbrasil-sync-daily',
    'deadline-alerts-hourly',
    'weekly-report-monday'
  );

  PERFORM cron.schedule(
    'jusbrasil-sync-daily',
    '0 7 * * 1-5',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-jusbrasil-sync', v_headers::text)
  );

  PERFORM cron.schedule(
    'deadline-alerts-hourly',
    '0 * * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-deadline-alerts', v_headers::text)
  );

  PERFORM cron.schedule(
    'weekly-report-monday',
    '0 8 * * 1',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $f$, v_base || '/api/public/hooks/run-weekly-report', v_headers::text)
  );
END
$$;
