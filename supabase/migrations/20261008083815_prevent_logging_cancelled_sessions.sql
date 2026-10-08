-- Logging follows the same session lifecycle as billing: ACTIVE, with no
-- calendar cancellation tombstone. Trial and non-billable sessions still need
-- attendance logs. This migration does not change existing historical logs.

CREATE OR REPLACE FUNCTION public.enforce_tutor_log_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session_active boolean;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'tutor_log_submitter_required';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'tutor_log_submitter_is_immutable';
  END IF;

  IF NEW.logged_for_staff_id IS NULL THEN
    RAISE EXCEPTION 'tutor_log_logged_for_staff_required';
  END IF;

  PERFORM 1
  FROM public.sessions_staff
  WHERE session_id = NEW.session_id
    AND staff_id = NEW.logged_for_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tutor_log_logged_for_staff_must_be_assigned';
  END IF;

  -- Lock the session until this write commits. A concurrent cancellation must
  -- finish before eligibility is checked, or wait until this log is committed.
  -- Existing historical logs can still be corrected without restoring sessions.
  IF TG_OP = 'INSERT' OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    SELECT status = 'ACTIVE' AND calendar_tombstone_until IS NULL
    INTO v_session_active
    FROM public.sessions
    WHERE id = NEW.session_id
    FOR SHARE;

    IF v_session_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Cannot log an inactive or cancelled session.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_tutor_log_provenance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_tutor_log_provenance()
  TO service_role, postgres;

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unlogged_sessions
WITH (security_invoker = true)
AS
SELECT
  s.id AS session_id,
  s.start_at,
  s.end_at,
  s.type AS session_type,
  TRIM(
    BOTH
    FROM
      COALESCE(
        NULLIF(TRIM(BOTH FROM COALESCE(s.short_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(s.long_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(sub.name, '')), ''),
        'Session'
      )
  ) AS session_name,
  s.subject_id,
  sub.name AS subject_name,
  s.class_id,
  c.day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  (
    SELECT
      COALESCE(
        json_agg(
          json_build_object(
            'id',
            st.id,
            'first_name',
            st.first_name,
            'last_name',
            st.last_name,
            'email',
            st.email,
            'type',
            ss.type
          )
        ),
        '[]'::json
      )
    FROM public.sessions_staff ss
    JOIN public.staff st ON st.id = ss.staff_id
    WHERE
      ss.session_id = s.id
  ) AS assigned_tutors,
  (
    SELECT COUNT(*)::integer
    FROM
      public.sessions_students ss2
    WHERE
      ss2.session_id = s.id
      AND ss2.planned_absence = false
  ) AS student_count,
  s.created_at,
  s.updated_at
FROM
  public.sessions s
  LEFT JOIN public.subjects sub ON sub.id = s.subject_id
  LEFT JOIN public.classes c ON c.id = s.class_id
WHERE
  s.status = 'ACTIVE'
  AND s.calendar_tombstone_until IS NULL
  AND s.start_at < NOW()
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.tutor_logs tl
    WHERE
      tl.session_id = s.id
  );

REVOKE ALL ON public.vadmin_reconciliation_unlogged_sessions FROM PUBLIC, anon;
GRANT SELECT ON public.vadmin_reconciliation_unlogged_sessions TO authenticated, service_role;

COMMENT ON VIEW public.vadmin_reconciliation_unlogged_sessions IS
  'Admin view: Active, non-tombstoned past sessions without tutor logs, including trial and non-billable sessions.';

-- Expose lifecycle fields through the assigned-tutor facade. Keep cancelled
-- history in the general view; unlogged callers filter these appended fields.
CREATE OR REPLACE VIEW public.vtutor_sessions
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  class.day_of_week AS class_day_of_week,
  class.start_time AS class_start_time,
  class.end_time AS class_end_time,
  class.room AS class_room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  session.original_start_at,
  session.original_end_at,
  session.short_name,
  session.long_name,
  session.status AS session_status,
  session.calendar_tombstone_until
FROM public.sessions session
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session.id IN (
  SELECT session_id
  FROM public.sessions_staff
  WHERE staff_id = (select public.current_tutor_id())
);

GRANT SELECT ON public.vtutor_sessions TO authenticated;

