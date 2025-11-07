-- Fix the sync functions to not reference non-existent 'attended' column
-- The sessions_students table doesn't have an 'attended' column

-- Function to remove student from future sessions on unenrollment
CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_unenrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Only run if unenrolled_at was just set (changed from NULL to a timestamp)
  IF OLD.unenrolled_at IS NULL AND NEW.unenrolled_at IS NOT NULL THEN
    -- Remove student from sessions starting from their unenrollment date
    -- This preserves sessions before unenrollment
    -- We remove from all future sessions regardless of planned_absence status
    DELETE FROM public.sessions_students ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.student_id = NEW.student_id
      AND s.class_id = NEW.class_id
      AND s.start_at >= NEW.unenrolled_at;
    
    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
    
    RAISE NOTICE 'Removed student % from % sessions starting from %', 
      NEW.student_id, sessions_affected, NEW.unenrolled_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to re-sync sessions when enrollment date is modified
CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_enrollment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_removed INTEGER := 0;
  sessions_added INTEGER := 0;
BEGIN
  -- Only run if enrolled_at was changed
  IF OLD.enrolled_at != NEW.enrolled_at THEN
    -- Remove from sessions that are now before the new enrolled_at
    -- Only remove from future sessions (start_at >= NOW())
    DELETE FROM public.sessions_students ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.student_id = NEW.student_id
      AND s.class_id = NEW.class_id
      AND s.start_at < NEW.enrolled_at
      AND s.start_at >= OLD.enrolled_at
      AND s.start_at >= NOW();
    
    GET DIAGNOSTICS sessions_removed = ROW_COUNT;
    
    -- Add to sessions that are now included
    INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
    SELECT
      uuid_generate_v4(),
      s.id,
      NEW.student_id,
      NEW.enrolled_by
    FROM public.sessions s
    WHERE s.class_id = NEW.class_id
      AND s.start_at >= NEW.enrolled_at
      AND s.start_at < OLD.enrolled_at
      AND s.start_at >= NOW() -- Only add to future sessions
    ON CONFLICT (session_id, student_id) DO NOTHING;
    
    GET DIAGNOSTICS sessions_added = ROW_COUNT;
    
    RAISE NOTICE 'Enrollment date updated: removed from % sessions, added to % sessions', 
      sessions_removed, sessions_added;
  END IF;
  
  RETURN NEW;
END;
$$;

