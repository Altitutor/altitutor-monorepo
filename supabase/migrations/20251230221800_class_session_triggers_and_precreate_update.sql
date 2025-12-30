-- Migration: Class session triggers and precreate_sessions update
-- Description:
--   - Create trigger to automatically create sessions for rest of calendar year when class is created
--   - Create trigger to delete only future sessions when class is deleted (preserve historical)
--   - Update precreate_sessions function to ensure sessions exist for rest of current year
--   - Make precreate_sessions fully idempotent (safe to run multiple times as cleanup function)

-- ========================
-- UPDATE PRECREATE_SESSIONS FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.precreate_sessions(
  start_date DATE,
  end_date DATE,
  p_created_by UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  d DATE;
  c RECORD;
  inserted_count INTEGER := 0;
  new_session_id UUID;
  start_local TIMESTAMP;
  end_local TIMESTAMP;
  s_at TIMESTAMPTZ;
  e_at TIMESTAMPTZ;
  actual_start_date DATE;
  actual_end_date DATE;
BEGIN
  -- If p_class_id is NULL and dates are NULL, default to rest of current year
  IF p_class_id IS NULL AND start_date IS NULL AND end_date IS NULL THEN
    actual_start_date := CURRENT_DATE;
    actual_end_date := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day';
  ELSIF start_date IS NULL OR end_date IS NULL THEN
    RETURN 0;
  ELSE
    actual_start_date := start_date;
    actual_end_date := end_date;
  END IF;

  IF actual_start_date > actual_end_date THEN
    RETURN 0;
  END IF;

  FOR c IN
    SELECT id, day_of_week, start_time, end_time, subject_id, status
    FROM public.classes
    WHERE (p_class_id IS NULL OR id = p_class_id)
  LOOP
    d := actual_start_date;
    WHILE d <= actual_end_date LOOP
      -- day_of_week: Postgres DOW 0=Sunday..6=Saturday; our schema uses 0..6 as well
      IF EXTRACT(DOW FROM d) = c.day_of_week THEN
        -- Build start/end timestamps using Adelaide timezone
        -- Interpret class times (stored as 'HH24:MI' text) as Adelaide local times
        start_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.start_time, '00:00'))::timestamp;
        end_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.end_time, COALESCE(c.start_time, '00:00')))::timestamp;
        
        -- Convert Adelaide local time to UTC for storage
        s_at := start_local AT TIME ZONE 'Australia/Adelaide';
        e_at := end_local AT TIME ZONE 'Australia/Adelaide';

        -- Find existing session for this class/start/end (idempotency check)
        SELECT s.id
        INTO new_session_id
        FROM public.sessions s
        WHERE s.class_id = c.id
          AND s.start_at = s_at
          AND s.end_at = e_at
        LIMIT 1;

        -- If not found, create it (idempotent - only creates if doesn't exist)
        IF new_session_id IS NULL THEN
          INSERT INTO public.sessions(
            id, start_at, end_at, type, class_id, subject_id, status
          ) VALUES (
            gen_random_uuid(),
            s_at,
            e_at,
            'CLASS',
            c.id,
            c.subject_id,
            c.status  -- Match class status
          ) RETURNING id INTO new_session_id;
          inserted_count := inserted_count + 1;
        END IF;

        -- Precreate planned students for the session (idempotent with ON CONFLICT)
        INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
        SELECT
          gen_random_uuid(),
          new_session_id,
          cs.student_id,
          p_created_by
        FROM public.classes_students cs
        WHERE cs.class_id = c.id
          AND cs.enrolled_at <= s_at
          AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s_at)
        ON CONFLICT (session_id, student_id) DO NOTHING;

        -- Precreate planned staff for the session (idempotent with ON CONFLICT)
        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          gen_random_uuid(),
          new_session_id,
          cst.staff_id,
          'MAIN_TUTOR',
          p_created_by
        FROM public.classes_staff cst
        WHERE cst.class_id = c.id
          AND cst.assigned_at <= s_at
          AND (cst.unassigned_at IS NULL OR cst.unassigned_at > s_at)
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_staff sf
            WHERE sf.session_id = new_session_id AND sf.staff_id = cst.staff_id
          )
        ON CONFLICT (session_id, staff_id) DO NOTHING;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- ========================
-- CREATE CLASS INSERT TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.create_sessions_on_class_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  year_end_date DATE;
BEGIN
  -- Calculate December 31 of current calendar year
  year_end_date := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day';
  
  -- Create sessions for the rest of the calendar year
  PERFORM public.precreate_sessions(
    CURRENT_DATE,
    year_end_date,
    NULL, -- created_by (system action)
    NEW.id -- p_class_id (specific class)
  );
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE CLASS DELETE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.delete_future_sessions_on_class_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete only future sessions (preserve historical data)
  DELETE FROM public.sessions
  WHERE class_id = OLD.id
    AND start_at >= NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Note: We don't need to explicitly delete sessions_students or sessions_staff
  -- because they have ON DELETE CASCADE foreign keys to sessions
  
  RETURN OLD;
END;
$$;

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Trigger to create sessions when class is inserted
DROP TRIGGER IF EXISTS trigger_create_sessions_on_class_insert ON public.classes;
CREATE TRIGGER trigger_create_sessions_on_class_insert
AFTER INSERT ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.create_sessions_on_class_insert();

-- Trigger to delete future sessions when class is deleted
DROP TRIGGER IF EXISTS trigger_delete_future_sessions_on_class_delete ON public.classes;
CREATE TRIGGER trigger_delete_future_sessions_on_class_delete
BEFORE DELETE ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.delete_future_sessions_on_class_delete();

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.precreate_sessions IS 'Creates sessions for a date range. Fully idempotent - safe to run multiple times. When p_class_id is NULL and dates are NULL, defaults to rest of current calendar year. Acts as a cleanup function that ensures sessions exist.';
COMMENT ON FUNCTION public.create_sessions_on_class_insert IS 'Trigger function that creates sessions for the rest of the calendar year when a class is created.';
COMMENT ON FUNCTION public.delete_future_sessions_on_class_delete IS 'Trigger function that deletes only future sessions when a class is deleted, preserving historical data.';

