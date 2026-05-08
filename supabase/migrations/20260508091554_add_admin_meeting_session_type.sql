-- Add ADMIN_MEETING session type for internal admin meetings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'session_type'
      AND e.enumlabel = 'ADMIN_MEETING'
  ) THEN
    ALTER TYPE public.session_type ADD VALUE 'ADMIN_MEETING';
  END IF;
END
$$;
