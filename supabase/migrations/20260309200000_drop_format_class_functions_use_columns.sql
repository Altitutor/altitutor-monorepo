-- Migration: Use classes/sessions short_name/long_name; drop format_class_*; ILIKE-only search; centralise search behaviour
-- Description:
--   - Search RPCs use classes.short_name/long_name and sessions.short_name/long_name (no format_class_*).
--   - All search matching is ILIKE substring only (build_fuzzy_like removed from these functions; not dropped - still used by search_tutor_logs_admin).
--   - Centralised search: students/staff/parents = concat first_name last_name only; classes = short_name/long_name only; subjects = short_name/long_name only; topics = concat subject short_name + topic code + topic name only; files = concat subject short_name + file code + file name only.

-- ========================
-- 1. search_sessions_admin: search by session short_name/long_name (no format_class_*)
-- ========================

DROP FUNCTION IF EXISTS search_sessions_admin(
  TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION search_sessions_admin(
  p_search TEXT DEFAULT NULL,
  p_range_start TIMESTAMPTZ DEFAULT NULL,
  p_range_end TIMESTAMPTZ DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  p_admin_shift_id UUID DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_types TEXT[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'start_at',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_session_ids UUID[];
  v_sessions JSONB;
  v_total_count BIGINT;
  v_session_students JSONB;
  v_session_staff JSONB;
  v_tutor_logs JSONB;
  v_classes_by_id JSONB;
  v_subjects_by_id JSONB;
  v_class_ids UUID[];
  v_subject_ids UUID[];
  v_tutor_log_ids UUID[];
  v_student_ids UUID[];
  v_staff_ids UUID[];
  v_unplanned_student_ids JSONB;
  v_unplanned_staff_ids JSONB;
  v_actual_student_attendance JSONB;
  v_actual_staff_attendance JSONB;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'sessions', '[]'::jsonb,
      'sessionStudents', '{}'::jsonb,
      'sessionStaff', '{}'::jsonb,
      'tutorLogs', '{}'::jsonb,
      'classesById', '{}'::jsonb,
      'subjectsById', '{}'::jsonb,
      'total', 0
    );
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_session_ids
    FROM (
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_students ss ON ss.session_id = s.id
      JOIN public.students st ON st.id = ss.student_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_staff sf ON sf.session_id = s.id
      JOIN public.staff stf ON stf.id = sf.staff_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(stf.first_name, ''), COALESCE(stf.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT s.id
      FROM public.sessions s
      WHERE LOWER(COALESCE(s.short_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.long_name, '')) LIKE '%' || v_search_lower || '%'
    ) search_results;
  END IF;

  WITH filtered_sessions AS (
    SELECT s.id, s.type, s.class_id, s.subject_id, s.admin_shift_id, s.start_at, s.end_at, s.status, s.created_at, s.updated_at
    FROM public.sessions s
    WHERE (v_session_ids IS NULL OR (array_length(v_session_ids, 1) > 0 AND s.id = ANY(v_session_ids)))
      AND (p_range_start IS NULL OR s.start_at >= p_range_start)
      AND (p_range_end IS NULL OR s.start_at <= p_range_end)
      AND (p_staff_id IS NULL OR EXISTS (SELECT 1 FROM public.sessions_staff sf WHERE sf.session_id = s.id AND sf.staff_id = p_staff_id))
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_student_id IS NULL OR EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id = s.id AND ss.student_id = p_student_id))
      AND (p_admin_shift_id IS NULL OR s.admin_shift_id = p_admin_shift_id)
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      AND (p_types IS NULL OR array_length(p_types, 1) IS NULL OR s.type::text = ANY(p_types))
  ),
  ordered_sessions AS (
    SELECT * FROM filtered_sessions
    ORDER BY
      CASE WHEN p_order_by = 'start_at' AND p_ascending THEN start_at END ASC,
      CASE WHEN p_order_by = 'start_at' AND NOT p_ascending THEN start_at END DESC,
      CASE WHEN p_order_by = 'end_at' AND p_ascending THEN end_at END ASC,
      CASE WHEN p_order_by = 'end_at' AND NOT p_ascending THEN end_at END DESC,
      CASE WHEN p_order_by = 'type' AND p_ascending THEN type END ASC,
      CASE WHEN p_order_by = 'type' AND NOT p_ascending THEN type END DESC,
      CASE WHEN p_order_by = 'class_id' AND p_ascending THEN class_id END ASC,
      CASE WHEN p_order_by = 'class_id' AND NOT p_ascending THEN class_id END DESC,
      start_at ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'type', type, 'class_id', class_id, 'subject_id', subject_id,
      'admin_shift_id', admin_shift_id, 'start_at', start_at, 'end_at', end_at,
      'status', status, 'created_at', created_at, 'updated_at', updated_at
    )), COUNT(*) OVER()::BIGINT
  INTO v_sessions, v_total_count
  FROM ordered_sessions;

  IF v_sessions IS NULL OR jsonb_array_length(v_sessions) = 0 THEN
    RETURN jsonb_build_object(
      'sessions', '[]'::jsonb, 'sessionStudents', '{}'::jsonb, 'sessionStaff', '{}'::jsonb,
      'tutorLogs', '{}'::jsonb, 'classesById', '{}'::jsonb, 'subjectsById', '{}'::jsonb, 'total', 0
    );
  END IF;

  SELECT ARRAY_AGG((s->>'id')::UUID) INTO v_session_ids FROM jsonb_array_elements(v_sessions) s;

  IF p_include_relationships THEN
    SELECT
      ARRAY_AGG(DISTINCT (s->>'class_id')::UUID) FILTER (WHERE (s->>'class_id') IS NOT NULL),
      ARRAY_AGG(DISTINCT (s->>'subject_id')::UUID) FILTER (WHERE (s->>'subject_id') IS NOT NULL)
    INTO v_class_ids, v_subject_ids
    FROM jsonb_array_elements(v_sessions) s;

    IF v_class_ids IS NOT NULL AND array_length(v_class_ids, 1) > 0 THEN
      SELECT jsonb_object_agg(id::TEXT, row_to_json(c)::jsonb) INTO v_classes_by_id
      FROM public.classes c WHERE c.id = ANY(v_class_ids);
      SELECT ARRAY_AGG(DISTINCT subject_id) FILTER (WHERE subject_id IS NOT NULL) INTO v_subject_ids
      FROM public.classes WHERE id = ANY(v_class_ids) AND subject_id IS NOT NULL;
    END IF;

    IF v_subject_ids IS NOT NULL AND array_length(v_subject_ids, 1) > 0 THEN
      SELECT jsonb_object_agg(id::TEXT, row_to_json(subj)::jsonb) INTO v_subjects_by_id
      FROM public.subjects subj WHERE subj.id = ANY(v_subject_ids);
    END IF;

    SELECT ARRAY_AGG(id) INTO v_tutor_log_ids FROM public.tutor_logs WHERE session_id = ANY(v_session_ids);

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH student_attendance_by_session AS (
        SELECT tl.session_id,
          jsonb_object_agg(tlsa.student_id::TEXT, jsonb_build_object('attended', tlsa.attended, 'was_trial', tlsa.was_trial)) as attendance_map
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map) INTO v_actual_student_attendance FROM student_attendance_by_session;

      WITH staff_attendance_by_session AS (
        SELECT tl.session_id,
          jsonb_object_agg(tlsf.staff_id::TEXT, jsonb_build_object('attended', tlsf.attended, 'type', tlsf.type, 'was_trial', tlsf.was_trial)) as attendance_map
        FROM public.tutor_logs_staff_attendance tlsf
        JOIN public.tutor_logs tl ON tl.id = tlsf.tutor_log_id
        WHERE tlsf.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map) INTO v_actual_staff_attendance FROM staff_attendance_by_session;
    END IF;

    WITH invoice_status_per_student AS (
      SELECT DISTINCT ON (ii.sessions_students_id) ii.sessions_students_id, inv.status as invoice_status
      FROM public.invoice_items ii
      JOIN public.invoices inv ON inv.id = ii.invoice_id
      WHERE ii.sessions_students_id IN (SELECT id FROM public.sessions_students WHERE session_id = ANY(v_session_ids))
      ORDER BY ii.sessions_students_id, inv.created_at DESC
    ),
    session_students_with_invoice AS (
      SELECT ss.session_id, ss.id as sessions_students_id, st.id as student_id, st.first_name, st.last_name, st.status,
        st.curriculum, st.year_level, st.school,
        COALESCE(ss.planned_absence, false) as planned_absence, COALESCE(ss.was_trial, false) as was_trial,
        COALESCE(ss.is_rescheduled, false) as is_rescheduled, COALESCE(ss.is_credited, false) as is_credited,
        CASE WHEN rs.id IS NULL THEN NULL ELSE jsonb_build_object('session', jsonb_build_object('id', rs.id, 'start_at', rs.start_at, 'class', CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('start_time', rc.start_time) END)) END as rescheduled_session,
        COALESCE((v_actual_student_attendance->ss.session_id::TEXT->st.id::TEXT->>'attended')::boolean, NULL) as actual_attended,
        COALESCE((v_actual_student_attendance->ss.session_id::TEXT->st.id::TEXT->>'was_trial')::boolean, NULL) as actual_was_trial,
        COALESCE(iss.invoice_status, NULL) as invoice_status,
        CASE WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true ELSE false END as is_extra
      FROM public.sessions_students ss
      JOIN public.students st ON st.id = ss.student_id
      JOIN public.sessions s ON s.id = ss.session_id
      LEFT JOIN invoice_status_per_student iss ON iss.sessions_students_id = ss.id
      LEFT JOIN public.sessions_students rss ON rss.id = ss.rescheduled_sessions_students_id
      LEFT JOIN public.sessions rs ON rs.id = rss.session_id
      LEFT JOIN public.classes rc ON rc.id = rs.class_id
      LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id AND cs.student_id = ss.student_id AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      WHERE ss.session_id = ANY(v_session_ids)
    ),
    session_students_aggregated AS (
      SELECT session_id, jsonb_agg(jsonb_build_object(
        'id', student_id, 'first_name', first_name, 'last_name', last_name, 'status', status, 'curriculum', curriculum,
        'year_level', year_level, 'school', school, 'planned_absence', planned_absence, 'was_trial', was_trial,
        'is_rescheduled', is_rescheduled, 'is_credited', is_credited, 'rescheduled_session', rescheduled_session,
        'actual_attended', actual_attended, 'actual_was_trial', actual_was_trial, 'sessions_students_id', sessions_students_id,
        'invoice_status', invoice_status, 'is_extra', is_extra
      )) as students
      FROM session_students_with_invoice GROUP BY session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, students) INTO v_session_students FROM session_students_aggregated;

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH unplanned_students AS (
        SELECT DISTINCT tl.session_id, tlsa.student_id, tlsa.attended, tlsa.was_trial
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tl.session_id = ANY(v_session_ids)
          AND NOT EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id = tl.session_id AND ss.student_id = tlsa.student_id)
      ),
      unplanned_student_details AS (
        SELECT us.session_id, st.id, st.first_name, st.last_name, st.status, st.curriculum, st.year_level, st.school, us.attended, us.was_trial,
          CASE WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true ELSE false END as is_extra
        FROM unplanned_students us
        JOIN public.students st ON st.id = us.student_id
        JOIN public.sessions s ON s.id = us.session_id
        LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id AND cs.student_id = us.student_id AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      ),
      unplanned_students_aggregated AS (
        SELECT session_id, jsonb_agg(jsonb_build_object(
          'id', id, 'first_name', first_name, 'last_name', last_name, 'status', status, 'curriculum', curriculum,
          'year_level', year_level, 'school', school, 'planned_absence', true, 'was_trial', was_trial,
          'is_rescheduled', false, 'is_credited', false, 'rescheduled_session', NULL,
          'actual_attended', attended, 'actual_was_trial', was_trial, 'sessions_students_id', NULL,
          'invoice_status', NULL, 'is_extra', is_extra
        )) as students
        FROM unplanned_student_details GROUP BY session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, students) INTO v_unplanned_student_ids FROM unplanned_students_aggregated;
      IF v_unplanned_student_ids IS NOT NULL THEN
        SELECT jsonb_object_agg(k, COALESCE(v_session_students->k, '[]'::jsonb) || COALESCE(v_unplanned_student_ids->k, '[]'::jsonb))
        INTO v_session_students
        FROM (SELECT DISTINCT k FROM jsonb_object_keys(COALESCE(v_session_students, '{}'::jsonb) || COALESCE(v_unplanned_student_ids, '{}'::jsonb)) k) all_keys;
      END IF;
    END IF;

    WITH session_staff_aggregated AS (
      SELECT sf.session_id,
        jsonb_agg(
          jsonb_build_object(
            'id', stf.id,
            'sessions_staff_id', sf.id,
            'first_name', stf.first_name,
            'last_name', stf.last_name,
            'role', stf.role,
            'status', stf.status,
            'planned_absence', COALESCE(sf.planned_absence, false),
            'was_trial', COALESCE(sf.was_trial, false),
            'is_swapped', COALESCE(sf.is_swapped, false),
            'swapped_staff', CASE WHEN swapped_stf.id IS NULL THEN NULL ELSE jsonb_build_object('id', swapped_stf.id, 'first_name', swapped_stf.first_name, 'last_name', swapped_stf.last_name) END,
            'actual_attended', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'attended')::boolean, NULL),
            'actual_was_trial', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'was_trial')::boolean, NULL),
            'actual_type', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'type'), NULL),
            'is_swapped_in', EXISTS (SELECT 1 FROM public.sessions_staff other_sf WHERE other_sf.swapped_sessions_staff_id = sf.id)
          )
        ) as staff
      FROM public.sessions_staff sf
      JOIN public.staff stf ON stf.id = sf.staff_id
      LEFT JOIN public.sessions_staff swapped_sf ON swapped_sf.id = sf.swapped_sessions_staff_id
      LEFT JOIN public.staff swapped_stf ON swapped_stf.id = swapped_sf.staff_id
      WHERE sf.session_id = ANY(v_session_ids)
      GROUP BY sf.session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, staff) INTO v_session_staff FROM session_staff_aggregated;

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH unplanned_staff AS (
        SELECT DISTINCT tl.session_id, tlsf.staff_id, tlsf.attended, tlsf.type, tlsf.was_trial
        FROM public.tutor_logs_staff_attendance tlsf
        JOIN public.tutor_logs tl ON tl.id = tlsf.tutor_log_id
        WHERE tl.session_id = ANY(v_session_ids)
          AND NOT EXISTS (SELECT 1 FROM public.sessions_staff sf WHERE sf.session_id = tl.session_id AND sf.staff_id = tlsf.staff_id)
      ),
      unplanned_staff_details AS (
        SELECT us.session_id, stf.id, stf.first_name, stf.last_name, stf.role, stf.status, us.attended, us.type, us.was_trial
        FROM unplanned_staff us JOIN public.staff stf ON stf.id = us.staff_id
      ),
      unplanned_staff_aggregated AS (
        SELECT session_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'sessions_staff_id', NULL,
              'first_name', first_name,
              'last_name', last_name,
              'role', role,
              'status', status,
              'planned_absence', true,
              'was_trial', false,
              'is_swapped', false,
              'swapped_staff', NULL,
              'actual_attended', attended,
              'actual_was_trial', was_trial,
              'actual_type', type,
              'is_swapped_in', false
            )
          ) as staff
        FROM unplanned_staff_details
        GROUP BY session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, staff) INTO v_unplanned_staff_ids FROM unplanned_staff_aggregated;
      IF v_unplanned_staff_ids IS NOT NULL THEN
        SELECT jsonb_object_agg(k, COALESCE(v_session_staff->k, '[]'::jsonb) || COALESCE(v_unplanned_staff_ids->k, '[]'::jsonb))
        INTO v_session_staff
        FROM (SELECT DISTINCT k FROM jsonb_object_keys(COALESCE(v_session_staff, '{}'::jsonb) || COALESCE(v_unplanned_staff_ids, '{}'::jsonb)) k) all_keys;
      END IF;
    END IF;

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH tutor_logs_with_creator AS (
        SELECT tl.session_id,
          jsonb_build_object(
            'id', tl.id, 'created_by', tl.created_by,
            'created_by_name', jsonb_build_object('first_name', COALESCE(stf.first_name, ''), 'last_name', COALESCE(stf.last_name, ''))
          ) as log_data
        FROM public.tutor_logs tl
        LEFT JOIN public.staff stf ON stf.id = tl.created_by
        WHERE tl.id = ANY(v_tutor_log_ids)
      )
      SELECT jsonb_object_agg(session_id::TEXT, log_data) INTO v_tutor_logs FROM tutor_logs_with_creator;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sessions', COALESCE(v_sessions, '[]'::jsonb),
    'sessionStudents', COALESCE(v_session_students, '{}'::jsonb),
    'sessionStaff', COALESCE(v_session_staff, '{}'::jsonb),
    'tutorLogs', COALESCE(v_tutor_logs, '{}'::jsonb),
    'classesById', COALESCE(v_classes_by_id, '{}'::jsonb),
    'subjectsById', COALESCE(v_subjects_by_id, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_sessions_admin(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Search and filter sessions with relationships. Uses sessions.short_name/long_name for search. Returns sessionStaff with sessions_staff_id, was_trial, and actual_was_trial.';

-- ========================
-- 2. search_students_admin: class search by c.short_name / c.long_name
-- ========================

CREATE OR REPLACE FUNCTION search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_class_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_student_ids UUID[];
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- Search only by concat firstname lastname (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_student_ids
    FROM students
    WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_students AS (
    SELECT 
      s.id,
      s.first_name,
      s.last_name,
      s.status,
      s.curriculum,
      s.year_level,
      s.school,
      s.phone,
      s.email,
      s.created_at,
      s.updated_at,
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
        ELSE 0
      END AS relevance_score
    FROM students s
    WHERE (v_student_ids IS NULL OR (array_length(v_student_ids, 1) > 0 AND s.id = ANY(v_student_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      AND (
        p_subject_ids IS NULL 
        OR array_length(p_subject_ids, 1) IS NULL 
        OR EXISTS (
          SELECT 1
          FROM students_subjects ss
          WHERE ss.student_id = s.id
            AND ss.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM classes_students cs
          JOIN classes c ON c.id = cs.class_id
          WHERE cs.student_id = s.id
            AND cs.unenrolled_at IS NULL
            AND c.subject_id = ANY(p_subject_ids)
        )
      )
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY 
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'curriculum' AND p_ascending THEN curriculum END ASC,
      CASE WHEN p_order_by = 'curriculum' AND NOT p_ascending THEN curriculum END DESC,
      CASE WHEN p_order_by = 'year_level' AND p_ascending THEN year_level END ASC,
      CASE WHEN p_order_by = 'year_level' AND NOT p_ascending THEN year_level END DESC,
      last_name ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'first_name', ps.first_name,
        'last_name', ps.last_name,
        'status', ps.status,
        'curriculum', ps.curriculum,
        'year_level', ps.year_level,
        'school', ps.school,
        'phone', ps.phone,
        'email', ps.email,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at,
        'classes', CASE 
          WHEN p_include_relationships THEN (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', c.id,
                  'day_of_week', c.day_of_week,
                  'start_time', c.start_time::TEXT,
                  'end_time', c.end_time::TEXT,
                  'level', c.level,
                  'subject', jsonb_build_object(
                    'id', subj.id,
                    'curriculum', subj.curriculum,
                    'year_level', subj.year_level,
                    'name', subj.name,
                    'discipline', subj.discipline,
                    'level', subj.level,
                    'color', subj.color,
                    'short_name', subj.short_name,
                    'long_name', subj.long_name
                  )
                )
                ORDER BY c.day_of_week, c.start_time
              ),
              '[]'::jsonb
            )
            FROM classes_students cs
            JOIN classes c ON c.id = cs.class_id
            LEFT JOIN subjects subj ON subj.id = c.subject_id
            WHERE cs.student_id = ps.id
              AND cs.unenrolled_at IS NULL
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students ps;

  RETURN jsonb_build_object(
    'students', COALESCE(v_students, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_students_admin IS 'Admin search function for students. Search only by concat first_name last_name (ILIKE).';

-- ========================
-- 3. search_staff_admin: class search by c.short_name / c.long_name
-- ========================

CREATE OR REPLACE FUNCTION search_staff_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_class_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_staff_ids UUID[];
  v_staff JSONB;
  v_total_count BIGINT;
  v_staff_classes JSONB;
  v_class_subjects JSONB;
  v_class_ids UUID[];
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('staff', '[]'::jsonb, 'staffClasses', '{}'::jsonb, 'classSubjects', '{}'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- Search only by concat firstname lastname (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_staff_ids
    FROM staff
    WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_staff AS (
    SELECT 
      st.id,
      st.first_name,
      st.last_name,
      st.role,
      st.status,
      st.email,
      st.phone_number,
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
        ELSE 0
      END AS relevance_score
    FROM staff st
    WHERE (v_staff_ids IS NULL OR (array_length(v_staff_ids, 1) > 0 AND st.id = ANY(v_staff_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR st.status = ANY(p_statuses))
      AND (
        p_subject_ids IS NULL 
        OR array_length(p_subject_ids, 1) IS NULL 
        OR EXISTS (SELECT 1 FROM staff_subjects ss WHERE ss.staff_id = st.id AND ss.subject_id = ANY(p_subject_ids))
        OR EXISTS (
          SELECT 1 FROM classes_staff cs
          JOIN classes c ON c.id = cs.class_id
          WHERE cs.staff_id = st.id AND cs.unassigned_at IS NULL AND c.subject_id = ANY(p_subject_ids)
        )
      )
  ),
  paginated_staff AS (
    SELECT * FROM filtered_staff
    ORDER BY relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'role' AND p_ascending THEN role END ASC,
      CASE WHEN p_order_by = 'role' AND NOT p_ascending THEN role END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      last_name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
      'id', ps.id, 'first_name', ps.first_name, 'last_name', ps.last_name,
      'role', ps.role, 'status', ps.status, 'email', ps.email, 'phone_number', ps.phone_number
    )), (SELECT COUNT(*) FROM filtered_staff)
  INTO v_staff, v_total_count FROM paginated_staff ps;

  IF p_include_relationships AND v_staff IS NOT NULL THEN
    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_staff) AS elem(value) WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT ARRAY_AGG(DISTINCT cs.class_id) INTO v_class_ids FROM classes_staff cs JOIN staff_ids si ON si.id = cs.staff_id WHERE cs.unassigned_at IS NULL;

    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_staff) AS elem(value) WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(si.id::TEXT, (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'day_of_week', c.day_of_week, 'start_time', c.start_time::TEXT, 'end_time', c.end_time::TEXT,
        'status', c.status, 'room', c.room, 'level', c.level, 'subject_id', c.subject_id,
        'subject', jsonb_build_object('id', subj.id, 'curriculum', subj.curriculum, 'year_level', subj.year_level, 'name', subj.name, 'discipline', subj.discipline, 'level', subj.level, 'color', subj.color, 'short_name', subj.short_name, 'long_name', subj.long_name)
      ) ORDER BY c.day_of_week, c.start_time), '[]'::jsonb)
      FROM classes_staff cs2 JOIN classes c ON c.id = cs2.class_id LEFT JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs2.staff_id = si.id AND cs2.unassigned_at IS NULL
    )) INTO v_staff_classes FROM staff_ids si;

    IF v_class_ids IS NOT NULL THEN
      SELECT jsonb_object_agg(class_id::TEXT, jsonb_build_object('id', subj.id, 'curriculum', subj.curriculum, 'year_level', subj.year_level, 'name', subj.name, 'discipline', subj.discipline, 'level', subj.level, 'color', subj.color, 'short_name', subj.short_name, 'long_name', subj.long_name))
      INTO v_class_subjects FROM unnest(v_class_ids) AS class_id JOIN classes c ON c.id = class_id LEFT JOIN subjects subj ON subj.id = c.subject_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('staff', COALESCE(v_staff, '[]'::jsonb), 'staffClasses', COALESCE(v_staff_classes, '{}'::jsonb), 'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

COMMENT ON FUNCTION search_staff_admin IS 'Admin search function for staff. Search only by concat first_name last_name (ILIKE).';

-- ========================
-- 4. search_classes_admin: use c.short_name and c.long_name instead of format_class_*
-- ========================

CREATE OR REPLACE FUNCTION search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_student_search BOOLEAN DEFAULT FALSE,
  p_exclude_staff_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'day_of_week',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_class_ids UUID[];
  v_classes JSONB;
  v_total_count BIGINT;
  v_class_subjects JSONB;
  v_class_students JSONB;
  v_class_staff JSONB;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('classes', '[]'::jsonb, 'classSubjects', '{}'::jsonb, 'classStudents', '{}'::jsonb, 'classStaff', '{}'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  -- Search only by class short_name and long_name (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_class_ids
    FROM classes c
    WHERE LOWER(COALESCE(c.short_name, '')) LIKE '%' || v_search_lower || '%'
       OR LOWER(COALESCE(c.long_name, '')) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_classes AS (
    SELECT c.id, c.day_of_week, c.start_time, c.end_time, c.status, c.room, c.subject_id, c.level,
      CASE WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(COALESCE(c.short_name, '')) = v_search_lower THEN 1000
        WHEN LOWER(COALESCE(c.short_name, '')) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(COALESCE(c.short_name, '')) LIKE '%' || v_search_lower || '%' THEN 800
        WHEN LOWER(COALESCE(c.long_name, '')) = v_search_lower THEN 750
        WHEN LOWER(COALESCE(c.long_name, '')) LIKE v_search_lower || '%' THEN 700
        WHEN LOWER(COALESCE(c.long_name, '')) LIKE '%' || v_search_lower || '%' THEN 600
        ELSE 0
      END AS relevance_score
    FROM classes c
    WHERE (v_class_ids IS NULL OR (array_length(v_class_ids, 1) > 0 AND c.id = ANY(v_class_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR c.status = ANY(p_statuses))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR c.subject_id = ANY(p_subject_ids))
  ),
  paginated_classes AS (
    SELECT * FROM filtered_classes
    ORDER BY relevance_score DESC,
      CASE WHEN p_order_by = 'day_of_week' AND p_ascending THEN day_of_week END ASC,
      CASE WHEN p_order_by = 'day_of_week' AND NOT p_ascending THEN day_of_week END DESC,
      CASE WHEN p_order_by = 'start_time' AND p_ascending THEN start_time END ASC,
      CASE WHEN p_order_by = 'start_time' AND NOT p_ascending THEN start_time END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      day_of_week ASC, start_time ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object('id', pc.id, 'day_of_week', pc.day_of_week, 'start_time', pc.start_time::TEXT, 'end_time', pc.end_time::TEXT, 'status', pc.status, 'room', pc.room, 'subject_id', pc.subject_id, 'level', pc.level)), (SELECT COUNT(*) FROM filtered_classes)
  INTO v_classes, v_total_count FROM paginated_classes pc;

  IF p_include_relationships AND v_classes IS NOT NULL THEN
    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, jsonb_build_object('id', subj.id, 'curriculum', subj.curriculum, 'year_level', subj.year_level, 'name', subj.name, 'discipline', subj.discipline, 'level', subj.level, 'color', subj.color, 'short_name', subj.short_name, 'long_name', subj.long_name))
    INTO v_class_subjects FROM class_ids ci JOIN classes c ON c.id = ci.id LEFT JOIN subjects subj ON subj.id = c.subject_id;

    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'status', s.status, 'curriculum', s.curriculum, 'year_level', s.year_level, 'school', s.school) ORDER BY s.last_name, s.first_name), '[]'::jsonb) FROM classes_students cs JOIN students s ON s.id = cs.student_id WHERE cs.class_id = ci.id AND cs.unenrolled_at IS NULL))
    INTO v_class_students FROM class_ids ci;

    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', st.id, 'first_name', st.first_name, 'last_name', st.last_name, 'role', st.role, 'status', st.status) ORDER BY st.last_name, st.first_name), '[]'::jsonb) FROM classes_staff cs JOIN staff st ON st.id = cs.staff_id WHERE cs.class_id = ci.id AND cs.unassigned_at IS NULL))
    INTO v_class_staff FROM class_ids ci;
  END IF;

  RETURN jsonb_build_object('classes', COALESCE(v_classes, '[]'::jsonb), 'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb), 'classStudents', COALESCE(v_class_students, '{}'::jsonb), 'classStaff', COALESCE(v_class_staff, '{}'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;

COMMENT ON FUNCTION search_classes_admin IS 'Admin search function for classes. Search only by class short_name and long_name (ILIKE).';

-- ========================
-- 5. search_parents_admin: only concat first_name last_name (ILIKE)
-- ========================

CREATE OR REPLACE FUNCTION search_parents_admin(
  p_search TEXT DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_parent_ids UUID[];
  v_parents JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('parents', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  -- Search only by concat firstname lastname (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_parent_ids
    FROM parents
    WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_parents AS (
    SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.created_at, p.updated_at
    FROM parents p
    WHERE (v_parent_ids IS NULL OR (array_length(v_parent_ids, 1) > 0 AND p.id = ANY(v_parent_ids)))
  ),
  paginated_parents AS (
    SELECT * FROM filtered_parents
    ORDER BY
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'email' AND p_ascending THEN email END ASC,
      CASE WHEN p_order_by = 'email' AND NOT p_ascending THEN email END DESC,
      last_name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', pp.id,
        'first_name', pp.first_name,
        'last_name', pp.last_name,
        'email', pp.email,
        'phone', pp.phone,
        'created_at', pp.created_at,
        'updated_at', pp.updated_at,
        'students', CASE
          WHEN p_include_relationships THEN (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', s.id,
                  'first_name', s.first_name,
                  'last_name', s.last_name,
                  'status', s.status,
                  'curriculum', s.curriculum,
                  'year_level', s.year_level,
                  'school', s.school
                )
                ORDER BY s.last_name, s.first_name
              ),
              '[]'::jsonb
            )
            FROM parents_students ps2
            JOIN students s ON s.id = ps2.student_id
            WHERE ps2.parent_id = pp.id
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_parents)
  INTO v_parents, v_total_count
  FROM paginated_parents pp;

  RETURN jsonb_build_object('parents', COALESCE(v_parents, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_parents_admin TO authenticated;
COMMENT ON FUNCTION search_parents_admin IS 'Admin search function for parents. Search only by concat first_name last_name (ILIKE).';

-- ========================
-- 6. search_subjects_admin: only subject short_name and long_name (ILIKE)
-- ========================

CREATE OR REPLACE FUNCTION search_subjects_admin(
  p_search TEXT DEFAULT NULL,
  p_year_levels INTEGER[] DEFAULT NULL,
  p_curriculums TEXT[] DEFAULT NULL,
  p_disciplines TEXT[] DEFAULT NULL,
  p_levels TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_subject_ids UUID[];
  v_subjects JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('subjects', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  -- Search only by subject short_name and long_name (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_subject_ids
    FROM subjects
    WHERE LOWER(COALESCE(short_name, '')) LIKE '%' || v_search_lower || '%'
       OR LOWER(COALESCE(long_name, '')) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_subjects AS (
    SELECT s.id, s.name, s.curriculum, s.year_level, s.discipline, s.level, s.color, s.short_name, s.long_name, s.created_at, s.updated_at
    FROM subjects s
    WHERE (v_subject_ids IS NULL OR (array_length(v_subject_ids, 1) > 0 AND s.id = ANY(v_subject_ids)))
      AND (p_year_levels IS NULL OR array_length(p_year_levels, 1) IS NULL OR s.year_level = ANY(p_year_levels))
      AND (p_curriculums IS NULL OR array_length(p_curriculums, 1) IS NULL OR s.curriculum::text = ANY(p_curriculums))
      AND (p_disciplines IS NULL OR array_length(p_disciplines, 1) IS NULL OR s.discipline::text = ANY(p_disciplines))
      AND (p_levels IS NULL OR array_length(p_levels, 1) IS NULL OR s.level = ANY(p_levels))
  ),
  total_count AS (
    SELECT COUNT(*) AS count FROM filtered_subjects
  ),
  paginated_subjects AS (
    SELECT * FROM filtered_subjects
    ORDER BY
      CASE WHEN p_order_by = 'name' AND p_ascending THEN name END ASC,
      CASE WHEN p_order_by = 'name' AND NOT p_ascending THEN name END DESC,
      CASE WHEN p_order_by = 'curriculum' AND p_ascending THEN curriculum END ASC,
      CASE WHEN p_order_by = 'curriculum' AND NOT p_ascending THEN curriculum END DESC,
      CASE WHEN p_order_by = 'year_level' AND p_ascending THEN year_level END ASC,
      CASE WHEN p_order_by = 'year_level' AND NOT p_ascending THEN year_level END DESC,
      CASE WHEN p_order_by = 'discipline' AND p_ascending THEN discipline END ASC,
      CASE WHEN p_order_by = 'discipline' AND NOT p_ascending THEN discipline END DESC,
      CASE WHEN p_order_by = 'level' AND p_ascending THEN level END ASC,
      CASE WHEN p_order_by = 'level' AND NOT p_ascending THEN level END DESC,
      name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'name', ps.name,
        'curriculum', ps.curriculum,
        'year_level', ps.year_level,
        'discipline', ps.discipline,
        'level', ps.level,
        'color', ps.color,
        'short_name', ps.short_name,
        'long_name', ps.long_name,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at
      )
    ),
    MAX(tc.count)
  INTO v_subjects, v_total_count
  FROM paginated_subjects ps
  CROSS JOIN total_count tc;

  RETURN jsonb_build_object('subjects', COALESCE(v_subjects, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_subjects_admin TO authenticated;
COMMENT ON FUNCTION search_subjects_admin IS 'Admin search function for subjects. Search only by subject short_name and long_name (ILIKE).';

-- ========================
-- 7. search_topics_admin: only concat subject shortname + topic code + topic name (ILIKE)
-- ========================

CREATE OR REPLACE FUNCTION search_topics_admin(
  p_search TEXT DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_topic_ids UUID[];
  v_topics JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('topics', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  -- Search only by concat subject short_name + topic code + topic name (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT t.id), ARRAY[]::UUID[])
    INTO v_topic_ids
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE LOWER(CONCAT_WS(' ', COALESCE(s.short_name, ''), COALESCE(t.code, ''), COALESCE(t.name, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_topics AS (
    SELECT t.id, t.subject_id, t.name, t.parent_id, t.index, t.code, t.created_at, t.updated_at, t.created_by,
      s.id AS subject_id_full, s.name AS subject_name, s.curriculum AS subject_curriculum, s.year_level AS subject_year_level,
      s.discipline AS subject_discipline, s.level AS subject_level, s.color AS subject_color,
      s.short_name AS subject_short_name, s.long_name AS subject_long_name
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE (v_topic_ids IS NULL OR (array_length(v_topic_ids, 1) > 0 AND t.id = ANY(v_topic_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
  ),
  total_count_cte AS (
    SELECT COUNT(*) AS count FROM filtered_topics
  )
  SELECT COUNT(*) INTO v_total_count FROM total_count_cte;

  WITH filtered_topics AS (
    SELECT t.id, t.subject_id, t.name, t.parent_id, t.index, t.code, t.created_at, t.updated_at, t.created_by,
      s.id AS subject_id_full, s.name AS subject_name, s.curriculum AS subject_curriculum, s.year_level AS subject_year_level,
      s.discipline AS subject_discipline, s.level AS subject_level, s.color AS subject_color,
      s.short_name AS subject_short_name, s.long_name AS subject_long_name
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE (v_topic_ids IS NULL OR (array_length(v_topic_ids, 1) > 0 AND t.id = ANY(v_topic_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
  ),
  paginated_topics AS (
    SELECT * FROM filtered_topics
    ORDER BY subject_short_name ASC, code ASC, name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pt.id,
      'subject_id', pt.subject_id,
      'name', pt.name,
      'parent_id', pt.parent_id,
      'index', pt.index,
      'code', pt.code,
      'created_at', pt.created_at,
      'updated_at', pt.updated_at,
      'created_by', pt.created_by,
      'subject', jsonb_build_object(
        'id', pt.subject_id_full,
        'name', pt.subject_name,
        'curriculum', pt.subject_curriculum,
        'year_level', pt.subject_year_level,
        'discipline', pt.subject_discipline,
        'level', pt.subject_level,
        'color', pt.subject_color,
        'short_name', pt.subject_short_name,
        'long_name', pt.subject_long_name
      )
    )
  ) INTO v_topics FROM paginated_topics pt;

  RETURN jsonb_build_object('topics', COALESCE(v_topics, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_topics_admin TO authenticated;
COMMENT ON FUNCTION search_topics_admin IS 'Admin search function for topics. Search only by concat subject short_name + topic code + topic name (ILIKE).';

-- ========================
-- 8. search_files_admin: only concat subject shortname + file code + file name (ILIKE)
-- ========================

CREATE OR REPLACE FUNCTION search_files_admin(
  p_search TEXT DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_topic_ids UUID[] DEFAULT NULL,
  p_file_types TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_file_ids UUID[];
  v_files JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('files', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  -- Search only by concat subject short_name + file code + file name (ILIKE substring)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT tf.id), ARRAY[]::UUID[])
    INTO v_file_ids
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND LOWER(CONCAT_WS(' ', COALESCE(s.short_name, ''), COALESCE(tf.code, ''), COALESCE(f.filename, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_files AS (
    SELECT DISTINCT
      tf.id AS topics_file_id,
      tf.topic_id,
      tf.type,
      tf.index,
      tf.code,
      tf.file_id,
      tf.is_solutions,
      tf.created_at,
      tf.updated_at,
      tf.created_by,
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.metadata AS file_metadata,
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      s.id AS subject_id,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.id = ANY(v_file_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  total_count_cte AS (
    SELECT COUNT(*) AS count FROM filtered_files
  )
  SELECT COUNT(*) INTO v_total_count FROM total_count_cte;

  WITH filtered_files AS (
    SELECT DISTINCT
      tf.id AS topics_file_id,
      tf.topic_id,
      tf.type,
      tf.index,
      tf.code,
      tf.file_id,
      tf.is_solutions,
      tf.created_at,
      tf.updated_at,
      tf.created_by,
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.metadata AS file_metadata,
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      s.id AS subject_id,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.id = ANY(v_file_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  paginated_files AS (
    SELECT * FROM filtered_files
    ORDER BY subject_short_name ASC, topic_name ASC, index ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pf.topics_file_id,
      'topic_id', pf.topic_id,
      'type', pf.type,
      'index', pf.index,
      'code', pf.code,
      'file_id', pf.file_id,
      'is_solutions', pf.is_solutions,
      'created_at', pf.created_at,
      'updated_at', pf.updated_at,
      'created_by', pf.created_by,
      'file', jsonb_build_object(
        'filename', pf.filename,
        'mimetype', pf.mimetype,
        'size_bytes', pf.size_bytes,
        'storage_path', pf.storage_path,
        'bucket', pf.bucket,
        'storage_provider', pf.storage_provider,
        'metadata', pf.file_metadata
      ),
      'topic', jsonb_build_object(
        'id', pf.topic_id_full,
        'name', pf.topic_name,
        'code', pf.topic_code
      ),
      'subject', jsonb_build_object(
        'id', pf.subject_id,
        'name', pf.subject_name,
        'curriculum', pf.subject_curriculum,
        'year_level', pf.subject_year_level,
        'discipline', pf.subject_discipline,
        'level', pf.subject_level,
        'color', pf.subject_color,
        'short_name', pf.subject_short_name,
        'long_name', pf.subject_long_name
      )
    )
  ) INTO v_files FROM paginated_files pf;

  RETURN jsonb_build_object('files', COALESCE(v_files, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_files_admin TO authenticated;
COMMENT ON FUNCTION search_files_admin IS 'Admin search function for files. Search only by concat subject short_name + file code + file name (ILIKE).';

-- ========================
-- 9. Drop format_class_short_name and format_class_full_name
-- ========================

DROP FUNCTION IF EXISTS public.format_class_short_name(integer, time, text, integer, text);
DROP FUNCTION IF EXISTS public.format_class_full_name(integer, time, time, text, integer, text);
