-- Idempotent fix: ensure users can read their own staff row for role checks

DO $$
BEGIN
  -- enable RLS (safe if already enabled)
  PERFORM 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff';
  IF FOUND THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN OTHERS THEN
      -- ignore if already enabled
      NULL;
    END;

    -- create or replace policy in an idempotent way
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'staff'
        AND policyname = 'Self can read own staff row'
    ) THEN
      EXECUTE 'CREATE POLICY "Self can read own staff row" ON public.staff FOR SELECT TO authenticated USING (user_id = auth.uid())';
    END IF;
  END IF;
END$$;


