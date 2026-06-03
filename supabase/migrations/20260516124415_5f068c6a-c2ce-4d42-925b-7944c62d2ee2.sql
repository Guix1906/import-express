
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications'
      AND policyname='members can insert notifications for colleagues'
  ) THEN
    CREATE POLICY "members can insert notifications for colleagues"
      ON public.notifications FOR INSERT TO authenticated
      WITH CHECK (
        is_company_member(auth.uid(), company_id)
        AND is_company_member(user_id, company_id)
      );
  END IF;
END $$;
