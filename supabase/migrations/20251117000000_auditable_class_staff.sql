-- Migration: Auditable Class Staff Assignment System
-- Description:
--   - Remove start_date, end_date, status from classes_staff
--   - Add assigned_at, assigned_by, unassigned_at, unassigned_by for audit trail
--   - Update precreate_sessions to use new schema
--   - Update views and RLS policies

-- ========================
-- UPDATE CLASSES_STAFF TABLE SCHEMA
-- ========================

-- Add new audit and assignment tracking columns
ALTER TABLE public.classes_staff
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unassigned_by UUID REFERENCES public.staff(id);

-- Migrate existing data: use created_at as assigned_at for existing records
-- For records with status = 'ACTIVE', set assigned_at = created_at
-- For records with status = 'INACTIVE', set assigned_at = created_at and unassigned_at = updated_at (if end_date exists, use that)
UPDATE public.classes_staff
SET assigned_at = created_at
WHERE assigned_at IS NULL;

-- Migrate end_date to unassigned_at for inactive records
-- Ensure unassigned_at is always >= assigned_at to satisfy constraint
UPDATE public.classes_staff
SET unassigned_at = CASE 
  WHEN end_date IS NOT NULL THEN 
    -- Try to parse end_date as date and convert to timestamp
    -- Ensure it's at least equal to assigned_at (created_at)
    GREATEST(
      (end_date || ' 00:00:00+00')::TIMESTAMPTZ,
      COALESCE(assigned_at, created_at)
    )
  WHEN status = 'INACTIVE' AND updated_at IS NOT NULL THEN
    -- Ensure updated_at is at least equal to assigned_at
    GREATEST(
      updated_at,
      COALESCE(assigned_at, created_at)
    )
  ELSE NULL
END
WHERE unassigned_at IS NULL AND (status = 'INACTIVE' OR end_date IS NOT NULL);

-- Now make assigned_at NOT NULL
ALTER TABLE public.classes_staff
  ALTER COLUMN assigned_at SET NOT NULL;

-- ========================
-- DROP DEPENDENT VIEWS
-- ========================
-- Drop views that depend on classes_staff.status before dropping the column
DROP VIEW IF EXISTS public.vtutor_topics_files CASCADE;
DROP VIEW IF EXISTS public.vtutor_topics CASCADE;
DROP VIEW IF EXISTS public.vtutor_subjects CASCADE;
DROP VIEW IF EXISTS public.vtutor_class_detail CASCADE;
DROP VIEW IF EXISTS public.vtutor_classes CASCADE;
DROP VIEW IF EXISTS public.vstudent_class_detail CASCADE;
DROP VIEW IF EXISTS public.vstudent_class_detail_fixed CASCADE;

-- Drop old columns
ALTER TABLE public.classes_staff
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS status;

-- Drop old unique constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'class_assignments_staff_id_class_id_start_date_key'
  ) THEN
    ALTER TABLE public.classes_staff 
      DROP CONSTRAINT class_assignments_staff_id_class_id_start_date_key;
  END IF;
END $$;

-- Fix any remaining data issues where unassigned_at <= assigned_at
-- This can happen if end_date or updated_at is before created_at
UPDATE public.classes_staff
SET unassigned_at = assigned_at + INTERVAL '1 second'
WHERE unassigned_at IS NOT NULL 
  AND assigned_at IS NOT NULL
  AND unassigned_at <= assigned_at;

-- Add check constraint
ALTER TABLE public.classes_staff
  ADD CONSTRAINT classes_staff_unassigned_after_assigned_chk 
  CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classes_staff_assigned_at 
  ON public.classes_staff(assigned_at);
CREATE INDEX IF NOT EXISTS idx_classes_staff_unassigned_at 
  ON public.classes_staff(unassigned_at);
CREATE INDEX IF NOT EXISTS idx_classes_staff_assigned_by 
  ON public.classes_staff(assigned_by);
CREATE INDEX IF NOT EXISTS idx_classes_staff_unassigned_by 
  ON public.classes_staff(unassigned_by);
CREATE INDEX IF NOT EXISTS idx_classes_staff_active 
  ON public.classes_staff(class_id, staff_id) 
  WHERE unassigned_at IS NULL;

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
        -- Use new assigned_at/unassigned_at fields instead of start_date/end_date/status
        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          uuid_generate_v4(),
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
-- RECREATE TUTOR VIEWS
-- ========================

-- Recreate vtutor_classes view to use new fields
CREATE OR REPLACE VIEW public.vtutor_classes
WITH (security_invoker = false)
AS
SELECT 
  c.id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level,
  c.status,
  c.subject_id,
  c.created_at,
  c.updated_at,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id 
  FROM public.classes_staff 
  WHERE staff_id = public.current_tutor_id() 
    AND unassigned_at IS NULL
)
AND c.status = 'ACTIVE';

GRANT SELECT ON public.vtutor_classes TO authenticated;

COMMENT ON VIEW public.vtutor_classes IS 'Tutor view: All active classes linked to the tutor via classes_staff';

-- Update vtutor_class_detail view to use new fields
CREATE OR REPLACE VIEW public.vtutor_class_detail
WITH (security_invoker = false)
AS
SELECT
  c.id AS class_id,
  c.subject_id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.status AS class_status,
  c.room,
  c.level,
  sub.name AS subject_name,
  sub.color AS subject_color,
  -- Students in this class (scoped fields only)
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'status', s.status,
      'school', s.school,
      'curriculum', s.curriculum,
      'year_level', s.year_level,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'enrollment_id', cs.id,
      'enrolled_at', cs.enrolled_at,
      'unenrolled_at', cs.unenrolled_at
    ))
    FROM public.classes_students cs
    JOIN public.students s ON s.id = cs.student_id
    WHERE cs.class_id = c.id 
      AND cs.unenrolled_at IS NULL
  ) AS students,
  -- Staff in this class (all fields for coordination)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'email', st.email,
      'phone', st.phone_number,
      'role', st.role,
      'status', st.status,
      'classes_staff_id', cst.id,
      'assigned_at', cst.assigned_at,
      'unassigned_at', cst.unassigned_at
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id 
      AND cst.unassigned_at IS NULL
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id 
  FROM public.classes_staff 
  WHERE staff_id = public.current_tutor_id() 
    AND unassigned_at IS NULL
);

GRANT SELECT ON public.vtutor_class_detail TO authenticated;

COMMENT ON VIEW public.vtutor_class_detail IS 'Tutor view: Detailed class information with students (scoped) and staff';

-- Recreate vtutor_subjects view to use new fields
CREATE OR REPLACE VIEW public.vtutor_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.billing_type,
  sub.session_fee_cents,
  sub.currency,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  -- Direct via staff_subjects
  SELECT subject_id 
  FROM public.staff_subjects 
  WHERE staff_id = public.current_tutor_id()
  
  UNION
  
  -- Indirect via classes (classes.subject_id is direct FK)
  SELECT c.subject_id 
  FROM public.classes c
  JOIN public.classes_staff cs ON cs.class_id = c.id
  WHERE cs.staff_id = public.current_tutor_id()
    AND cs.unassigned_at IS NULL
    AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vtutor_subjects TO authenticated;

COMMENT ON VIEW public.vtutor_subjects IS 'Tutor view: All subjects the tutor is authorized to access (direct or via classes)';

-- Recreate vtutor_topics view (depends on vtutor_subjects)
CREATE OR REPLACE VIEW public.vtutor_topics
WITH (security_invoker = false)
AS
SELECT 
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
  t.created_at,
  t.updated_at,
  t.created_by
FROM public.topics t
WHERE t.subject_id IN (
  SELECT id FROM public.vtutor_subjects
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vtutor_topics TO authenticated;

COMMENT ON VIEW public.vtutor_topics IS 'Tutor view: All topics for authorized subjects';

-- Recreate vtutor_topics_files view (depends on vtutor_topics)
CREATE OR REPLACE VIEW public.vtutor_topics_files
WITH (security_invoker = false)
AS
SELECT 
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.file_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by
FROM public.topics_files tf
WHERE tf.topic_id IN (
  SELECT id FROM public.vtutor_topics
)
ORDER BY tf.topic_id, tf.index;

GRANT SELECT ON public.vtutor_topics_files TO authenticated;

COMMENT ON VIEW public.vtutor_topics_files IS 'Tutor view: All topics_files for authorized topics';

-- ========================
-- UPDATE STUDENT VIEWS
-- ========================

-- Update vstudent_class_detail view to use new fields
CREATE OR REPLACE VIEW public.vstudent_class_detail
WITH (security_invoker = on)
AS
SELECT 
  c.id AS class_id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  c.subject_id,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Students in this class (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'year_level', s.year_level
    ))
    FROM public.classes_students cs2
    JOIN public.students s ON s.id = cs2.student_id
    WHERE cs2.class_id = c.id AND cs2.unenrolled_at IS NULL
  ) AS students,
  -- Staff in this class (limited info + subjects they teach)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'role', st.role,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', subj.id,
          'name', subj.name
        ))
        FROM public.staff_subjects ss
        JOIN public.subjects subj ON subj.id = ss.subject_id
        WHERE ss.staff_id = st.id
      )
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id AND cst.unassigned_at IS NULL
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE EXISTS (
  SELECT 1 FROM public.classes_students cs
  WHERE cs.class_id = c.id 
    AND cs.student_id = public.current_student_id()
    AND cs.unenrolled_at IS NULL
);

-- Update the fix_student_views_security view as well
CREATE OR REPLACE VIEW public.vstudent_class_detail_fixed
WITH (security_invoker = on)
AS
SELECT 
  c.id AS class_id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  c.subject_id,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Students in this class (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'year_level', s.year_level
    ))
    FROM public.classes_students cs2
    JOIN public.students s ON s.id = cs2.student_id
    WHERE cs2.class_id = c.id AND cs2.unenrolled_at IS NULL
  ) AS students,
  -- Staff in this class (limited info + subjects they teach)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'role', st.role,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss
        JOIN public.subjects subj ON subj.id = ss.subject_id
        WHERE ss.staff_id = st.id
      )
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id
    AND cst.unassigned_at IS NULL
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE EXISTS (
  SELECT 1 FROM public.classes_students cs
  WHERE cs.class_id = c.id 
    AND cs.student_id = public.current_student_id()
    AND cs.unenrolled_at IS NULL
);

