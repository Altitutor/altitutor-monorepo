-- Migration: Add end_date to classes table and update session triggers
-- Description:
--   - Add end_date column to classes table to allow limiting session creation to a specific date range
--   - Update create_sessions_on_class_insert trigger to respect end_date
--   - Create update trigger to handle start_date/end_date changes (only affects future sessions)
--   - When start_date/end_date is modified, create/delete sessions accordingly but ONLY for future sessions

-- ========================
-- ADD COLUMN TO CLASSES TABLE
-- ========================

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS session_end_date DATE;

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN public.classes.session_end_date IS 'Optional end date for session creation. If NULL, sessions are created until the end of the calendar year containing session_start_date. If set, sessions are created only up to this date (inclusive).';

-- ========================
-- UPDATE INSERT TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.create_sessions_on_class_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  year_end_date DATE;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Use session_start_date if set, otherwise use CURRENT_DATE (backward compatible)
  IF NEW.session_start_date IS NOT NULL THEN
    start_date := NEW.session_start_date;
  ELSE
    start_date := CURRENT_DATE;
  END IF;
  
  -- Use session_end_date if set, otherwise use end of calendar year containing start_date
  IF NEW.session_end_date IS NOT NULL THEN
    end_date := NEW.session_end_date;
  ELSE
    end_date := DATE_TRUNC('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Ensure start_date <= end_date
  IF start_date > end_date THEN
    RAISE WARNING 'session_start_date (%) is after session_end_date (%), skipping session creation', start_date, end_date;
    RETURN NEW;
  END IF;
  
  -- Create sessions for the date range (inclusive)
  -- The precreate_sessions function will handle date validation and only create future sessions
  PERFORM public.precreate_sessions(
    start_date,
    end_date,
    NULL, -- created_by (system action)
    NEW.id -- p_class_id (specific class)
  );
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE UPDATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.sync_sessions_on_class_date_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_start_date DATE;
  old_end_date DATE;
  new_start_date DATE;
  new_end_date DATE;
  effective_start_date DATE;
  effective_end_date DATE;
  year_end_date DATE;
BEGIN
  -- Determine old date range
  IF OLD.session_start_date IS NOT NULL THEN
    old_start_date := OLD.session_start_date;
  ELSE
    old_start_date := CURRENT_DATE;
  END IF;
  
  IF OLD.session_end_date IS NOT NULL THEN
    old_end_date := OLD.session_end_date;
  ELSE
    old_end_date := DATE_TRUNC('year', old_start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Determine new date range
  IF NEW.session_start_date IS NOT NULL THEN
    new_start_date := NEW.session_start_date;
  ELSE
    new_start_date := CURRENT_DATE;
  END IF;
  
  IF NEW.session_end_date IS NOT NULL THEN
    new_end_date := NEW.session_end_date;
  ELSE
    new_end_date := DATE_TRUNC('year', new_start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Only proceed if dates actually changed
  -- Note: day_of_week, start_time, end_time changes are handled by sync_sessions_on_class_property_change()
  IF OLD.session_start_date IS DISTINCT FROM NEW.session_start_date 
     OR OLD.session_end_date IS DISTINCT FROM NEW.session_end_date THEN
    
    -- Delete future sessions that are outside the new date range
    -- Only delete sessions that are in the future (preserve historical data)
    DELETE FROM public.sessions
    WHERE class_id = NEW.id
      AND start_at >= NOW() -- Only future sessions
      AND (
        -- Session is before new start date
        (start_at::DATE < new_start_date)
        OR
        -- Session is after new end date
        (start_at::DATE > new_end_date)
      );
    
    -- Create sessions for the new date range (only future sessions)
    -- Use the later of new_start_date and CURRENT_DATE to ensure we only create future sessions
    effective_start_date := GREATEST(new_start_date, CURRENT_DATE);
    effective_end_date := new_end_date;
    
    -- Only create if effective_start_date <= effective_end_date
    IF effective_start_date <= effective_end_date THEN
      PERFORM public.precreate_sessions(
        effective_start_date,
        effective_end_date,
        NULL, -- created_by (system action)
        NEW.id -- p_class_id (specific class)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE UPDATE TRIGGER
-- ========================

DROP TRIGGER IF EXISTS trigger_sync_sessions_on_class_date_update ON public.classes;
CREATE TRIGGER trigger_sync_sessions_on_class_date_update
AFTER UPDATE ON public.classes
FOR EACH ROW
WHEN (
  OLD.session_start_date IS DISTINCT FROM NEW.session_start_date
  OR OLD.session_end_date IS DISTINCT FROM NEW.session_end_date
)
EXECUTE FUNCTION public.sync_sessions_on_class_date_update();

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.create_sessions_on_class_insert IS 'Trigger function that creates sessions when a class is created. Respects session_start_date and session_end_date columns: if set, sessions are created within that date range (inclusive). If NULL, sessions are created from CURRENT_DATE until end of calendar year.';
COMMENT ON FUNCTION public.sync_sessions_on_class_date_update IS 'Trigger function that syncs sessions when class dates or times are updated. Only affects future sessions - deletes future sessions outside new date range and creates new sessions within the new date range. Preserves all historical (past) sessions.';
