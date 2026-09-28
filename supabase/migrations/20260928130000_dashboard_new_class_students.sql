-- Students attending their first enrolled session of a class.
-- Extra students (on the session, but not enrolled in the class) are excluded.
-- Tutors only receive rows for sessions they are assigned to.

CREATE OR REPLACE FUNCTION public.dashboard_new_class_students(p_session_ids uuid[])
RETURNS TABLE (session_id uuid, student_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_adminstaff_active() AND public.current_tutor_id() IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_session_ids IS NULL OR cardinality(p_session_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT session.id, session.class_id, session.start_at
    FROM public.sessions session
    WHERE session.id = ANY (p_session_ids)
      AND session.class_id IS NOT NULL
      AND session.start_at IS NOT NULL
      AND session.status = 'ACTIVE'
      AND session.type IN (
        'CLASS'::public.session_type,
        'DRAFTING'::public.session_type,
        'EXAM_COURSE'::public.session_type
      )
      AND (
        public.is_adminstaff_active()
        OR EXISTS (
          SELECT 1
          FROM public.sessions_staff assignment
          WHERE assignment.session_id = session.id
            AND assignment.staff_id = public.current_tutor_id()
        )
      )
  ),
  enrolled_roster AS (
    SELECT
      session.id AS session_id,
      session.class_id,
      session.start_at,
      roster.student_id,
      roster.planned_absence
    FROM public.sessions session
    JOIN public.sessions_students roster ON roster.session_id = session.id
    WHERE session.class_id IN (SELECT DISTINCT requested.class_id FROM requested)
      AND session.start_at IS NOT NULL
      AND session.status = 'ACTIVE'
      AND session.type IN (
        'CLASS'::public.session_type,
        'DRAFTING'::public.session_type,
        'EXAM_COURSE'::public.session_type
      )
      AND roster.is_rescheduled = false
      AND EXISTS (
        SELECT 1
        FROM public.classes_students enrollment
        WHERE enrollment.class_id = session.class_id
          AND enrollment.student_id = roster.student_id
          AND enrollment.enrolled_at <= session.start_at
          AND (
            enrollment.unenrolled_at IS NULL
            OR enrollment.unenrolled_at > session.start_at
          )
      )
  ),
  first_roster AS (
    SELECT DISTINCT ON (enrolled_roster.class_id, enrolled_roster.student_id)
      enrolled_roster.session_id,
      enrolled_roster.student_id
    FROM enrolled_roster
    ORDER BY enrolled_roster.class_id, enrolled_roster.student_id, enrolled_roster.start_at, enrolled_roster.session_id
  )
  SELECT requested.id, first_roster.student_id
  FROM requested
  JOIN first_roster ON first_roster.session_id = requested.id
  JOIN enrolled_roster attending
    ON attending.session_id = first_roster.session_id
   AND attending.student_id = first_roster.student_id
   AND attending.planned_absence = false;
END;
$$;

COMMENT ON FUNCTION public.dashboard_new_class_students(uuid[]) IS
  'Enrolled students attending their first active session of a class. Excludes extras, planned absences, and rescheduled-away occurrences.';

REVOKE ALL ON FUNCTION public.dashboard_new_class_students(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_new_class_students(uuid[]) TO authenticated;
