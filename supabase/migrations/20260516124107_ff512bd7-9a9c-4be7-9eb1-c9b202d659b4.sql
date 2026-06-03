
-- Realtime: emit full row data on updates
ALTER TABLE public.production_cards REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_comments REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_checklist REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_events REPLICA IDENTITY FULL;
ALTER TABLE public.production_card_watchers REPLICA IDENTITY FULL;

-- Add to realtime publication (ignore if already added)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_cards; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_checklist; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_card_watchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Storage policies for the existing 'documents' bucket, scoped per company folder
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can view company documents') THEN
    CREATE POLICY "members can view company documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can upload company documents') THEN
    CREATE POLICY "members can upload company documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can delete company documents') THEN
    CREATE POLICY "members can delete company documents"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'documents'
        AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      );
  END IF;
END $$;
