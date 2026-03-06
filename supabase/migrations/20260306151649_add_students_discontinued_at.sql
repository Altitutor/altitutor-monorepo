-- Migration: Add discontinued_at to students for marketing reports
-- Description: Mirrors registered_at pattern - set when status -> DISCONTINUED, never cleared.
-- Purpose: Enable student discontinuations report without querying activity_events.
-- Date: 2026-03-06

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS discontinued_at TIMESTAMPTZ;

COMMENT ON COLUMN public.students.discontinued_at IS 'When student status was changed to DISCONTINUED. Never cleared.';

-- Backfill: existing DISCONTINUED students get current timestamp (no historical data available)
UPDATE public.students
SET discontinued_at = NOW()
WHERE status = 'DISCONTINUED' AND discontinued_at IS NULL;

-- Trigger: set only when transitioning TO DISCONTINUED, never clear
CREATE OR REPLACE FUNCTION public.set_students_discontinued_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'DISCONTINUED' AND NEW.discontinued_at IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'DISCONTINUED' THEN
      NEW.discontinued_at := NOW();
    END IF;
  END IF;
  -- Never clear discontinued_at
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_students_discontinued_at ON public.students;
CREATE TRIGGER trigger_students_discontinued_at
  BEFORE INSERT OR UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_students_discontinued_at();

CREATE INDEX IF NOT EXISTS idx_students_discontinued_at ON public.students(discontinued_at)
  WHERE discontinued_at IS NOT NULL;
