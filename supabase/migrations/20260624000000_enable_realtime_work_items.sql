-- Ensure work item tables are part of the supabase_realtime publication.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.issues';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_tags';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projects';
  EXCEPTION WHEN others THEN NULL; END;

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
END $$;
