-- Migration: Replace uuid_generate_v4() with gen_random_uuid() in sync functions
-- Description:
--   - Replace uuid_generate_v4() with gen_random_uuid() in all enrollment and staff sync functions
--   - gen_random_uuid() is built-in PostgreSQL 13+ and doesn't require uuid-ossp extension
--   - This fixes the enrollment error: "function uuid_generate_v4() does not exist"

-- ========================
-- FIX STUDENT ENROLLMENT SYNC FUNCTIONS
-- ========================

-- Function to sync student to sessions when enrolled
CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Insert the student into all sessions for this class starting from enrolled_at
  INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
  SELECT
    gen_random_uuid(),
    s.id,
    NEW.student_id,
    NEW.enrolled_by
  FROM public.sessions s
  WHERE s.class_id = NEW.class_id
    AND s.start_at >= NEW.enrolled_at
  ON CONFLICT (session_id, student_id) DO NOTHING;

  GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  
  RAISE NOTICE 'Enrolled student % in % sessions starting from %', 
    NEW.student_id, sessions_affected, NEW.enrolled_at;
  
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
      gen_random_uuid(),
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

-- ========================
-- FIX STAFF ASSIGNMENT SYNC FUNCTIONS
-- ========================

-- Function to sync staff to sessions when assigned to class
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Insert the staff member into all future sessions for this class starting from assigned_at
  INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
  SELECT
    gen_random_uuid(),
    s.id,
    NEW.staff_id,
    'MAIN_TUTOR',
    NEW.assigned_by
  FROM public.sessions s
  WHERE s.class_id = NEW.class_id
    AND s.start_at >= NEW.assigned_at
  ON CONFLICT (session_id, staff_id) DO NOTHING;

  GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  
  RAISE NOTICE 'Assigned staff % to % sessions starting from %', 
    NEW.staff_id, sessions_affected, NEW.assigned_at;
  
  RETURN NEW;
END;
$$;

-- Function to re-sync sessions when assignment date is modified
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_removed INTEGER := 0;
  sessions_added INTEGER := 0;
BEGIN
  -- Only run if assigned_at was changed
  IF OLD.assigned_at IS DISTINCT FROM NEW.assigned_at THEN
    -- Remove from sessions that are now before the new assigned_at
    DELETE FROM public.sessions_staff ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.staff_id = NEW.staff_id
      AND s.class_id = NEW.class_id
      AND s.start_at < NEW.assigned_at
      AND s.start_at >= OLD.assigned_at
      AND ss.is_swapped = FALSE
      AND ss.planned_absence = FALSE;
    
    GET DIAGNOSTICS sessions_removed = ROW_COUNT;
    
    -- Add to sessions that are now included
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT
      gen_random_uuid(),
      s.id,
      NEW.staff_id,
      'MAIN_TUTOR',
      NEW.assigned_by
    FROM public.sessions s
    WHERE s.class_id = NEW.class_id
      AND s.start_at >= NEW.assigned_at
      AND s.start_at < OLD.assigned_at
    ON CONFLICT (session_id, staff_id) DO NOTHING;
    
    GET DIAGNOSTICS sessions_added = ROW_COUNT;
    
    RAISE NOTICE 'Assignment date updated: removed from % sessions, added to % sessions', 
      sessions_removed, sessions_added;
  END IF;
  
  RETURN NEW;
END;
$$;

