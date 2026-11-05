-- Reschedule availability is a SECURITY DEFINER read of other students' sessions.
-- Limit it to the active AdminStaff caller or the student named by p_student_id.
-- Keep data errors as an empty list, and let the authorization failure surface.
-- DEV-346

CREATE OR REPLACE FUNCTION public.get_available_reschedule_sessions(
  p_original_session_id uuid,
  p_student_id uuid,
  p_date_range_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_session record;
  v_subject_id uuid;
  v_original_class_id uuid;
  v_original_start_at timestamptz;
  v_now timestamptz := now();
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_effective_start_date timestamptz;
  v_session record;
  v_session_array jsonb := '[]'::jsonb;
  v_enrolled_session_ids uuid[];
  v_student_count integer;
BEGIN
  IF NOT public.is_adminstaff_active()
     AND p_student_id IS DISTINCT FROM public.current_student_id() THEN
    RAISE EXCEPTION 'Reschedule availability requires the student or active AdminStaff'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT s.id, s.start_at, s.class_id, COALESCE(s.subject_id, c.subject_id) AS subject_id
    INTO v_original_session
    FROM public.sessions s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_original_session_id;

    IF NOT FOUND OR v_original_session.subject_id IS NULL THEN
      RETURN '[]'::jsonb;
    END IF;

    v_subject_id := v_original_session.subject_id;
    v_original_class_id := v_original_session.class_id;
    v_original_start_at := v_original_session.start_at;
    v_start_date := v_original_start_at - (p_date_range_days || ' days')::interval;
    v_end_date := v_original_start_at + (p_date_range_days || ' days')::interval;
    v_effective_start_date := greatest(v_start_date, v_now);

    SELECT array_agg(session_id)
    INTO v_enrolled_session_ids
    FROM public.sessions_students
    WHERE student_id = p_student_id;

    v_enrolled_session_ids := COALESCE(v_enrolled_session_ids, ARRAY[]::uuid[]);

    FOR v_session IN
      SELECT
        s.id, s.start_at, s.end_at, s.class_id, s.type, s.status, s.subject_id,
        s.billing_type, s.room, s.short_name, s.long_name, s.created_at, s.updated_at,
        jsonb_build_object(
          'id', c.id, 'day_of_week', c.day_of_week, 'start_time', c.start_time,
          'end_time', c.end_time, 'room', c.room, 'level', c.level,
          'status', c.status, 'subject_id', c.subject_id, 'short_name', c.short_name,
          'long_name', c.long_name, 'created_at', c.created_at, 'updated_at', c.updated_at
        ) AS class,
        jsonb_build_object(
          'id', sub.id, 'name', sub.name, 'short_name', sub.short_name,
          'long_name', sub.long_name, 'curriculum', sub.curriculum,
          'discipline', sub.discipline, 'level', sub.level, 'color', sub.color,
          'year_level', sub.year_level, 'created_at', sub.created_at, 'updated_at', sub.updated_at
        ) AS subject
      FROM public.sessions s
      JOIN public.classes c ON c.id = s.class_id
      JOIN public.subjects sub ON sub.id = COALESCE(s.subject_id, c.subject_id)
      WHERE COALESCE(s.subject_id, c.subject_id) = v_subject_id
        AND s.class_id IS DISTINCT FROM v_original_class_id
        AND s.start_at >= v_effective_start_date
        AND s.start_at <= v_end_date
        AND s.id <> ALL(v_enrolled_session_ids)
        AND s.status = 'ACTIVE' AND s.calendar_tombstone_until IS NULL
        AND s.billing_type IS NOT NULL
        AND s.type <> 'TRIAL_SESSION'
      ORDER BY s.start_at
    LOOP
      SELECT count(*) INTO v_student_count
      FROM public.sessions_students
      WHERE session_id = v_session.id
        AND planned_absence = false;

      v_session_array := v_session_array || jsonb_build_array(jsonb_build_object(
        'id', v_session.id, 'start_at', v_session.start_at, 'end_at', v_session.end_at,
        'class_id', v_session.class_id, 'type', v_session.type, 'status', v_session.status,
        'subject_id', v_session.subject_id, 'billing_type', v_session.billing_type,
        'room', v_session.room, 'short_name', v_session.short_name,
        'long_name', v_session.long_name, 'created_at', v_session.created_at,
        'updated_at', v_session.updated_at, 'class', v_session.class,
        'subject', v_session.subject, 'studentCount', COALESCE(v_student_count, 0)
      ));
    END LOOP;

    RETURN v_session_array;
  EXCEPTION WHEN OTHERS THEN
    RETURN '[]'::jsonb;
  END;
END;
$$;

COMMENT ON FUNCTION public.get_available_reschedule_sessions(uuid, uuid, integer) IS
  'Returns active, billable, non-trial replacement sessions for the same subject and a different class. Callable by active AdminStaff or the named student. Capacity is returned as studentCount but does not block selection.';

GRANT EXECUTE ON FUNCTION public.get_available_reschedule_sessions(uuid, uuid, integer) TO authenticated;
