DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'issue_tags'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.issue_tags;
  END IF;
END $$;

DROP TABLE IF EXISTS public.issue_tags;
