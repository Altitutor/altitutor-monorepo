-- Ensure notes, documents, and activity feeds are in the realtime publication.
-- This is separate from 20260624000000 so existing databases that already
-- applied that migration still receive these later publication additions.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_documents';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_daily';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_folders';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events';
  EXCEPTION WHEN others THEN NULL; END;
END $$;
