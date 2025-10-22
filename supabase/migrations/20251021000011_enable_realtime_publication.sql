-- Migration: ensure new comms tables are in realtime publication
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
  EXCEPTION WHEN others THEN
    -- ignore if already added
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  EXCEPTION WHEN others THEN
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;


