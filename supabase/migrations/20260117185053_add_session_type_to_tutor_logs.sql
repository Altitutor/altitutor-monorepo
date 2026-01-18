-- Migration: Add session_type column to tutor_logs table
-- Description:
--   - Add denormalized session_type column to tutor_logs for automation rule conditions
--   - Automatically populate from related session on insert/update
--   - Keep in sync when session.type changes
--   - Handles all edge cases: missing sessions, NULL values, concurrent updates

-- ========================
-- 1. ADD session_type COLUMN
-- ========================
ALTER TABLE public.tutor_logs
  ADD COLUMN IF NOT EXISTS session_type public.session_type;

-- ========================
-- 2. POPULATE EXISTING RECORDS
-- ========================
-- Populate session_type for all existing tutor_logs
UPDATE public.tutor_logs tl
SET session_type = s.type
FROM public.sessions s
WHERE tl.session_id = s.id
  AND tl.session_type IS NULL;

-- ========================
-- 3. VALIDATE DATA INTEGRITY
-- ========================
-- Check if any tutor_logs have NULL session_type (shouldn't happen if FK is valid)
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM public.tutor_logs
  WHERE session_type IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE WARNING 'Found % tutor_logs with NULL session_type. These may have invalid session_id references.', v_null_count;
  END IF;
END $$;

-- ========================
-- 4. MAKE COLUMN NOT NULL
-- ========================
-- Set default for any remaining NULLs (shouldn't happen, but safety net)
UPDATE public.tutor_logs
SET session_type = 'CLASS'::public.session_type
WHERE session_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.tutor_logs
  ALTER COLUMN session_type SET NOT NULL;

-- ========================
-- 5. CREATE TRIGGER FUNCTION FOR tutor_logs
-- ========================
-- Function to set session_type when tutor_log is inserted or session_id is updated
CREATE OR REPLACE FUNCTION public.set_tutor_log_session_type()
RETURNS TRIGGER AS $$
DECLARE
  v_session_type public.session_type;
BEGIN
  -- Get session type from related session
  SELECT type INTO v_session_type
  FROM public.sessions
  WHERE id = NEW.session_id;
  
  -- Handle case where session doesn't exist (shouldn't happen due to FK, but safety)
  IF v_session_type IS NULL THEN
    RAISE EXCEPTION 'Session with id % does not exist', NEW.session_id;
  END IF;
  
  -- Set the session_type
  NEW.session_type := v_session_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION public.set_tutor_log_session_type() IS 
'Trigger function to automatically populate session_type from related session when tutor_log is inserted or session_id is updated.';

-- ========================
-- 6. CREATE TRIGGER ON tutor_logs
-- ========================
-- Trigger fires BEFORE INSERT or UPDATE of session_id
DROP TRIGGER IF EXISTS tutor_logs_set_session_type ON public.tutor_logs;
CREATE TRIGGER tutor_logs_set_session_type
  BEFORE INSERT OR UPDATE OF session_id ON public.tutor_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tutor_log_session_type();

-- ========================
-- 7. CREATE TRIGGER FUNCTION FOR sessions
-- ========================
-- Function to update tutor_logs.session_type when session.type changes
CREATE OR REPLACE FUNCTION public.sync_tutor_logs_session_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if type actually changed
  IF OLD.type IS DISTINCT FROM NEW.type THEN
    -- Update all tutor_logs for this session
    UPDATE public.tutor_logs
    SET session_type = NEW.type
    WHERE session_id = NEW.id;
    
    -- Log if no tutor_logs were updated (informational only)
    IF NOT FOUND THEN
      -- No tutor_logs exist for this session, which is fine
      NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION public.sync_tutor_logs_session_type() IS 
'Trigger function to keep tutor_logs.session_type in sync when session.type is updated.';

-- ========================
-- 8. CREATE TRIGGER ON sessions
-- ========================
-- Trigger fires AFTER UPDATE of type
DROP TRIGGER IF EXISTS sessions_sync_tutor_logs_session_type ON public.sessions;
CREATE TRIGGER sessions_sync_tutor_logs_session_type
  AFTER UPDATE OF type ON public.sessions
  FOR EACH ROW
  WHEN (OLD.type IS DISTINCT FROM NEW.type)
  EXECUTE FUNCTION public.sync_tutor_logs_session_type();

-- ========================
-- 9. ADD INDEX FOR PERFORMANCE
-- ========================
-- Index for automation rule queries filtering by session_type
CREATE INDEX IF NOT EXISTS idx_tutor_logs_session_type 
  ON public.tutor_logs(session_type);

-- ========================
-- 10. VALIDATION QUERIES (for testing)
-- ========================
-- These queries can be run manually to verify data integrity:
-- 
-- Check all tutor_logs have valid session_type:
-- SELECT COUNT(*) FROM tutor_logs WHERE session_type IS NULL;
-- 
-- Verify session_type matches session.type:
-- SELECT COUNT(*) FROM tutor_logs tl
-- JOIN sessions s ON tl.session_id = s.id
-- WHERE tl.session_type != s.type;
-- 
-- Check for orphaned tutor_logs (shouldn't exist due to FK CASCADE):
-- SELECT COUNT(*) FROM tutor_logs tl
-- LEFT JOIN sessions s ON tl.session_id = s.id
-- WHERE s.id IS NULL;
