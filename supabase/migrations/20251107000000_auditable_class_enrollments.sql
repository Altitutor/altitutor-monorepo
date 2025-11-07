-- Migration: Auditable Class Enrollment System
-- Description:
--   - Remove start_date, end_date, status from classes_students
--   - Add enrolled_at, enrolled_by, unenrolled_at, unenrolled_by for audit trail
--   - Create automatic session sync functions and triggers
--   - Update precreate_sessions to use new schema

-- ========================
-- UPDATE CLASSES_STUDENTS TABLE SCHEMA
-- ========================

-- Add new audit and enrollment tracking columns
ALTER TABLE public.classes_students
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS unenrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unenrolled_by UUID REFERENCES public.staff(id);

-- Migrate existing data: use created_at as enrolled_at for existing records
UPDATE public.classes_students
SET enrolled_at = created_at
WHERE enrolled_at IS NULL;

-- Now make enrolled_at NOT NULL
ALTER TABLE public.classes_students
  ALTER COLUMN enrolled_at SET NOT NULL;

-- Drop old columns
ALTER TABLE public.classes_students
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS status;

-- Drop old unique constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'classes_students_student_id_class_id_start_date_key'
  ) THEN
    ALTER TABLE public.classes_students 
      DROP CONSTRAINT classes_students_student_id_class_id_start_date_key;
  END IF;
END $$;

-- Add check constraint
ALTER TABLE public.classes_students
  ADD CONSTRAINT classes_students_unenrolled_after_enrolled_chk 
  CHECK (unenrolled_at IS NULL OR unenrolled_at > enrolled_at);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classes_students_enrolled_at 
  ON public.classes_students(enrolled_at);
CREATE INDEX IF NOT EXISTS idx_classes_students_unenrolled_at 
  ON public.classes_students(unenrolled_at);
CREATE INDEX IF NOT EXISTS idx_classes_students_enrolled_by 
  ON public.classes_students(enrolled_by);
CREATE INDEX IF NOT EXISTS idx_classes_students_unenrolled_by 
  ON public.classes_students(unenrolled_by);

-- ========================
-- CREATE SESSION SYNCHRONIZATION FUNCTIONS
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
    uuid_generate_v4(),
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

-- Function to remove student from sessions when unenrolled
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
    -- This preserves sessions before unenrollment and those already attended
    DELETE FROM public.sessions_students ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.student_id = NEW.student_id
      AND s.class_id = NEW.class_id
      AND s.start_at >= NEW.unenrolled_at
      AND ss.attended = FALSE;
    
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
    DELETE FROM public.sessions_students ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.student_id = NEW.student_id
      AND s.class_id = NEW.class_id
      AND s.start_at < NEW.enrolled_at
      AND s.start_at >= OLD.enrolled_at
      AND ss.attended = FALSE;
    
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
    ON CONFLICT (session_id, student_id) DO NOTHING;
    
    GET DIAGNOSTICS sessions_added = ROW_COUNT;
    
    RAISE NOTICE 'Enrollment date updated: removed from % sessions, added to % sessions', 
      sessions_removed, sessions_added;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Trigger for new enrollments
DROP TRIGGER IF EXISTS trigger_sync_student_on_enrollment ON public.classes_students;
CREATE TRIGGER trigger_sync_student_on_enrollment
AFTER INSERT ON public.classes_students
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_sessions_on_enrollment();

-- Trigger for unenrollments
DROP TRIGGER IF EXISTS trigger_sync_student_on_unenrollment ON public.classes_students;
CREATE TRIGGER trigger_sync_student_on_unenrollment
AFTER UPDATE ON public.classes_students
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_sessions_on_unenrollment();

-- Trigger for enrollment date changes
DROP TRIGGER IF EXISTS trigger_sync_student_on_enrollment_update ON public.classes_students;
CREATE TRIGGER trigger_sync_student_on_enrollment_update
AFTER UPDATE ON public.classes_students
FOR EACH ROW
WHEN (OLD.enrolled_at IS DISTINCT FROM NEW.enrolled_at)
EXECUTE FUNCTION public.sync_student_sessions_on_enrollment_update();

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
BEGIN
  IF start_date IS NULL OR end_date IS NULL OR start_date > end_date THEN
    RETURN 0;
  END IF;

  FOR c IN
    SELECT id, day_of_week, start_time, end_time, subject_id
    FROM public.classes
    WHERE status = 'ACTIVE'
      AND (p_class_id IS NULL OR id = p_class_id)
  LOOP
    d := start_date;
    WHILE d <= end_date LOOP
      -- day_of_week: Postgres DOW 0=Sunday..6=Saturday; our schema uses 0..6 as well
      IF EXTRACT(DOW FROM d) = c.day_of_week THEN
        -- Build start/end timestamps using Adelaide timezone
        -- Interpret class times (stored as 'HH24:MI' text) as Adelaide local times
        start_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.start_time, '00:00'))::timestamp;
        end_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.end_time, COALESCE(c.start_time, '00:00')))::timestamp;
        
        -- Convert Adelaide local time to UTC for storage
        s_at := start_local AT TIME ZONE 'Australia/Adelaide';
        e_at := end_local AT TIME ZONE 'Australia/Adelaide';

        -- Find existing session for this class/start/end
        SELECT s.id
        INTO new_session_id
        FROM public.sessions s
        WHERE s.class_id = c.id
          AND s.start_at = s_at
          AND s.end_at = e_at
        LIMIT 1;

        -- If not found, create it
        IF new_session_id IS NULL THEN
          INSERT INTO public.sessions(
            id, start_at, end_at, type, class_id, subject_id
          ) VALUES (
            uuid_generate_v4(),
            s_at,
            e_at,
            'CLASS',
            c.id,
            c.subject_id
          ) RETURNING id INTO new_session_id;
          inserted_count := inserted_count + 1;
        END IF;

        -- Precreate planned students for the session
        -- Use new enrolled_at/unenrolled_at fields instead of start_date/end_date
        INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
        SELECT
          uuid_generate_v4(),
          new_session_id,
          cs.student_id,
          p_created_by
        FROM public.classes_students cs
        WHERE cs.class_id = c.id
          AND cs.enrolled_at <= s_at
          AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s_at)
        ON CONFLICT (session_id, student_id) DO NOTHING;

        -- Precreate planned staff for the session (classes_staff active on this date)
        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          uuid_generate_v4(),
          new_session_id,
          cst.staff_id,
          'MAIN_TUTOR',
          p_created_by
        FROM public.classes_staff cst
        WHERE cst.class_id = c.id
          AND cst.status = 'ACTIVE'
          AND cst.start_date <= to_char(d, 'YYYY-MM-DD')
          AND (cst.end_date IS NULL OR cst.end_date >= to_char(d, 'YYYY-MM-DD'))
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

