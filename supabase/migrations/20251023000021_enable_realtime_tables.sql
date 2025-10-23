-- Ensure messages-related tables are part of the supabase_realtime publication
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts';
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reads';
  EXCEPTION WHEN others THEN NULL; END;
END $$;


