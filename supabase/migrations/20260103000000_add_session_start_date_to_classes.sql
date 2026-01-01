-- Migration: Add session_start_date to classes table
-- Description:
--   - Add session_start_date column to classes table to allow delaying session creation
--   - Update trigger function to respect session_start_date when creating sessions
--   - If session_start_date is NULL, sessions are created immediately (backward compatible)

-- ========================
-- ADD COLUMN TO CLASSES TABLE
-- ========================

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS session_start_date DATE;

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN public.classes.session_start_date IS 'Optional date to delay session creation. If NULL, sessions are created immediately from CURRENT_DATE. If set, sessions are created starting from this date.';

-- ========================
-- UPDATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.create_sessions_on_class_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  year_end_date DATE;
  start_date DATE;
BEGIN
  -- Use session_start_date if set, otherwise use CURRENT_DATE (backward compatible)
  IF NEW.session_start_date IS NOT NULL THEN
    start_date := NEW.session_start_date;
  ELSE
    start_date := CURRENT_DATE;
  END IF;
  
  -- Calculate December 31 of the calendar year containing start_date
  year_end_date := DATE_TRUNC('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  
  -- Create sessions for the rest of the calendar year starting from start_date
  -- The precreate_sessions function will handle date validation and only create future sessions
  PERFORM public.precreate_sessions(
    start_date,
    year_end_date,
    NULL, -- created_by (system action)
    NEW.id -- p_class_id (specific class)
  );
  
  RETURN NEW;
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.create_sessions_on_class_insert IS 'Trigger function that creates sessions when a class is created. Respects session_start_date column: if set, sessions are created starting from that date. If NULL, sessions are created immediately from CURRENT_DATE.';
