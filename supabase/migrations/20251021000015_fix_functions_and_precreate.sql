-- Migration: Drop remaining problematic functions and re-create precreate_sessions

-- ========================
-- DROP LEGACY/PROBLEMATIC FUNCTIONS
-- ========================
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT n.nspname AS schema_name,
           p.proname  AS function_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'student_select_subjects',
        'repair_student_accounts'
      )
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s);', r.schema_name, r.function_name, r.args);
  END LOOP;
END $$;

-- ========================
-- RE-CREATE precreate_sessions WITH DISAMBIGUATED PARAM NAMES
-- ========================
-- Drop old signature first (cannot change parameter names with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.precreate_sessions(date, date, uuid, uuid);

CREATE OR REPLACE FUNCTION public.precreate_sessions(
  start_date DATE,
  end_date DATE,
  p_created_by UUID,
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
      IF EXTRACT(DOW FROM d) = c.day_of_week THEN
        start_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.start_time, '00:00'))::timestamp;
        end_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.end_time, COALESCE(c.start_time, '00:00')))::timestamp;
        s_at := start_local AT TIME ZONE current_setting('TimeZone');
        e_at := end_local AT TIME ZONE current_setting('TimeZone');

        SELECT s.id INTO new_session_id
        FROM public.sessions s
        WHERE s.class_id = c.id
          AND s.start_at = s_at
          AND s.end_at = e_at
        LIMIT 1;

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

        INSERT INTO public.sessions_students (id, session_id, student_id, attended, created_by)
        SELECT
          uuid_generate_v4(),
          new_session_id,
          cs.student_id,
          FALSE,
          p_created_by
        FROM public.classes_students cs
        WHERE cs.class_id = c.id
          AND cs.status IN ('ACTIVE', 'TRIAL')
          AND cs.start_date <= to_char(d, 'YYYY-MM-DD')
          AND (cs.end_date IS NULL OR cs.end_date >= to_char(d, 'YYYY-MM-DD'))
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_students ss
            WHERE ss.session_id = new_session_id AND ss.student_id = cs.student_id
          );

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
          );
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;


