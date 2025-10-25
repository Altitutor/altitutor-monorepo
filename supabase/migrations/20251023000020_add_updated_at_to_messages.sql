-- Fix: messages table has update trigger but no updated_at column
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure trigger exists (idempotent; trigger was created previously)
DO $$
BEGIN
  BEGIN
    CREATE TRIGGER set_updated_at_messages
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  EXCEPTION WHEN others THEN
    -- ignore if trigger already exists
    NULL;
  END;
END $$;



