-- Migration: Fix session_id extraction in search_tutor_logs_admin
-- Description: Fix incorrect session_id extraction from JSONB array elements
-- The bug was introduced in 20260108220100_update_search_functions_and_views_for_codes.sql
-- where session_id was referenced directly instead of extracting from JSONB value

CREATE OR REPLACE FUNCTION search_tutor_logs_admin(
  -- Search & Filters
  p_search TEXT DEFAULT NULL,
  p_range_start DATE DEFAULT NULL,  -- Session date range start (Adelaide timezone)
  p_range_end DATE DEFAULT NULL,    -- Session date range end (Adelaide timezone)
  p_staff_id UUID DEFAULT NULL,    -- Filter by staff who created the tutor log or attended
  
  -- Pagination
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  
  -- Ordering
  p_order_by TEXT DEFAULT 'session_start_at',
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
  v_search_like TEXT;
  v_staff_ids UUID[];
  v_tutor_log_ids UUID[];
  v_tutor_logs JSONB;
  v_total_count BIGINT;
  v_sessions JSONB;
  v_session_students JSONB;
  v_session_staff JSONB;
  v_classes_by_id JSONB;
  v_subjects_by_id JSONB;
  v_staff_attendance JSONB;
  v_student_attendance JSONB;
  v_topics JSONB;
  v_topic_files JSONB;
  v_class_ids UUID[];
  v_subject_ids UUID[];
  v_session_ids UUID[];
  v_range_start_utc TIMESTAMPTZ;
  v_range_end_utc TIMESTAMPTZ;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'tutorLogs', '[]'::jsonb,
      'sessions', '{}'::jsonb,
      'sessionStudents', '{}'::jsonb,
      'sessionStaff', '{}'::jsonb,
      'classesById', '{}'::jsonb,
      'subjectsById', '{}'::jsonb,
      'staffAttendance', '{}'::jsonb,
      'studentAttendance', '{}'::jsonb,
      'topics', '{}'::jsonb,
      'topicFiles', '{}'::jsonb,
      'total', 0
    );
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Convert date range to UTC (Adelaide is UTC+10:30 or UTC+9:30 depending on DST)
  -- For simplicity, use UTC+10:30 (ACDT) as default
  IF p_range_start IS NOT NULL THEN
    v_range_start_utc := (p_range_start::TIMESTAMP AT TIME ZONE 'Australia/Adelaide')::TIMESTAMPTZ;
  END IF;
  IF p_range_end IS NOT NULL THEN
    -- Add 1 day and subtract 1 second to include the entire end date
    v_range_end_utc := ((p_range_end + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMP AT TIME ZONE 'Australia/Adelaide')::TIMESTAMPTZ;
  END IF;

  -- Build staff IDs array if p_staff_id provided
  IF p_staff_id IS NOT NULL THEN
    v_staff_ids := ARRAY[p_staff_id];
  END IF;

  -- Build main query with filters
  WITH filtered_tutor_logs AS (
    SELECT 
      tl.id,
      tl.session_id,
      tl.created_by,
      tl.created_at,
      tl.updated_at
    FROM public.tutor_logs tl
    JOIN public.sessions s ON s.id = tl.session_id
    WHERE 
      -- Search filter
      (v_search_lower IS NULL OR (
        -- Search in tutor log notes, topics, files, etc.
        EXISTS (
          SELECT 1 FROM public.tutor_logs_topics tlt
          JOIN public.topics t ON t.id = tlt.topic_id
          WHERE tlt.tutor_log_id = tl.id
          AND (
            LOWER(t.name) LIKE '%' || v_search_lower || '%'
            OR LOWER(COALESCE(t.code, '')) LIKE '%' || v_search_lower || '%'
            OR (v_search_like IS NOT NULL AND (
              t.name ILIKE v_search_like
              OR COALESCE(t.code, '') ILIKE v_search_like
            ))
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.tutor_logs_topics_files tltf
          JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
          WHERE tltf.tutor_log_id = tl.id
          AND (
            LOWER(COALESCE(tf.code, '')) LIKE '%' || v_search_lower || '%'
            OR (v_search_like IS NOT NULL AND COALESCE(tf.code, '') ILIKE v_search_like)
          )
        )
      ))
      -- Date range filter
      AND (p_range_start IS NULL OR s.start_at >= v_range_start_utc)
      AND (p_range_end IS NULL OR s.start_at <= v_range_end_utc)
      -- Staff filter
      AND (p_staff_id IS NULL OR tl.created_by = p_staff_id OR EXISTS (
        SELECT 1 FROM public.tutor_logs_staff_attendance tlsa
        WHERE tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id
      ))
  ),
  paginated_logs AS (
    SELECT *
    FROM filtered_tutor_logs
    ORDER BY 
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      CASE WHEN p_order_by = 'session_start_at' AND p_ascending THEN (
        SELECT start_at FROM public.sessions WHERE id = session_id
      ) END ASC,
      CASE WHEN p_order_by = 'session_start_at' AND NOT p_ascending THEN (
        SELECT start_at FROM public.sessions WHERE id = session_id
      ) END DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', pl.id,
        'session_id', pl.session_id,
        'created_by', pl.created_by,
        'created_at', pl.created_at,
        'updated_at', pl.updated_at
      )
    ),
    COUNT(*)
  INTO v_tutor_logs, v_total_count
  FROM paginated_logs pl;

  -- Collect session IDs - FIXED: Extract from JSONB value instead of referencing directly
  SELECT COALESCE(ARRAY_AGG(DISTINCT (value->>'session_id')::uuid), ARRAY[]::UUID[])
  INTO v_session_ids
  FROM jsonb_array_elements(COALESCE(v_tutor_logs, '[]'::jsonb))
  WHERE (value->>'session_id')::uuid IS NOT NULL;

  -- Collect class IDs and subject IDs from sessions
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT 
      COALESCE(ARRAY_AGG(DISTINCT class_id), ARRAY[]::UUID[]),
      COALESCE(ARRAY_AGG(DISTINCT subject_id), ARRAY[]::UUID[])
    INTO v_class_ids, v_subject_ids
    FROM sessions
    WHERE id = ANY(v_session_ids);
  END IF;

  -- Fetch sessions
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, row_to_json(s)::jsonb)
    INTO v_sessions
    FROM public.sessions s
    WHERE s.id = ANY(v_session_ids);
  END IF;

  -- Fetch session students
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    WITH session_students_aggregated AS (
      SELECT 
        ss.session_id,
        jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'status', st.status,
            'curriculum', st.curriculum,
            'year_level', st.year_level,
            'school', st.school,
            'planned_absence', COALESCE(ss.planned_absence, false),
            'is_extra', CASE 
              WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
              ELSE false
            END
          )
        ) as students
      FROM public.sessions_students ss
      JOIN public.students st ON st.id = ss.student_id
      JOIN public.sessions s ON s.id = ss.session_id
      LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id 
        AND cs.student_id = ss.student_id 
        AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      WHERE ss.session_id = ANY(v_session_ids)
      GROUP BY ss.session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, students)
    INTO v_session_students
    FROM session_students_aggregated;
  END IF;

  -- Fetch session staff
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    WITH session_staff_aggregated AS (
      SELECT 
        sf.session_id,
        jsonb_agg(
          jsonb_build_object(
            'id', stf.id,
            'first_name', stf.first_name,
            'last_name', stf.last_name,
            'email', stf.email,
            'role', stf.role,
            'planned_absence', COALESCE(sf.planned_absence, false)
          )
        ) as staff
      FROM public.sessions_staff sf
      JOIN public.staff stf ON stf.id = sf.staff_id
      WHERE sf.session_id = ANY(v_session_ids)
      GROUP BY sf.session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, staff)
    INTO v_session_staff
    FROM session_staff_aggregated;
  END IF;

  -- Fetch classes
  IF v_class_ids IS NOT NULL AND array_length(v_class_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, row_to_json(c)::jsonb)
    INTO v_classes_by_id
    FROM public.classes c
    WHERE c.id = ANY(v_class_ids);

    -- Add subject IDs from classes
    SELECT ARRAY_AGG(DISTINCT subject_id) FILTER (WHERE subject_id IS NOT NULL)
    INTO v_subject_ids
    FROM public.classes
    WHERE id = ANY(v_class_ids)
      AND subject_id IS NOT NULL;
  END IF;

  -- Fetch subjects (from sessions and classes)
  IF v_subject_ids IS NOT NULL AND array_length(v_subject_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, row_to_json(subj)::jsonb)
    INTO v_subjects_by_id
    FROM public.subjects subj
    WHERE subj.id = ANY(v_subject_ids);
  END IF;

  -- Extract tutor log IDs from JSONB for relationship queries
  SELECT ARRAY_AGG((tl->>'id')::UUID)
  INTO v_tutor_log_ids
  FROM jsonb_array_elements(COALESCE(v_tutor_logs, '[]'::jsonb)) tl;

  -- Fetch staff attendance
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    WITH staff_attendance_by_log AS (
      SELECT 
        tl.id as tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'staff_id', st.id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'role', st.role,
            'attended', tlsa.attended,
            'type', tlsa.type
          )
        ) as attendance
      FROM public.tutor_logs_staff_attendance tlsa
      JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
      JOIN public.staff st ON st.id = tlsa.staff_id
      WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tl.id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, attendance)
    INTO v_staff_attendance
    FROM staff_attendance_by_log;
  END IF;

  -- Fetch student attendance
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    WITH student_attendance_by_log AS (
      SELECT 
        tl.id as tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'student_id', st.id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'attended', tlsa.attended
          )
        ) as attendance
      FROM public.tutor_logs_student_attendance tlsa
      JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
      JOIN public.students st ON st.id = tlsa.student_id
      WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tl.id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, attendance)
    INTO v_student_attendance
    FROM student_attendance_by_log;
  END IF;

  -- Fetch topics with stored codes
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    WITH topics_by_log AS (
      SELECT 
        tlt.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'topic_id', t.id,
            'code', t.code,
            'name', t.name
          )
        ) as topics
      FROM public.tutor_logs_topics tlt
      JOIN public.topics t ON t.id = tlt.topic_id
      WHERE tlt.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tlt.tutor_log_id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, topics)
    INTO v_topics
    FROM topics_by_log;
  END IF;

  -- Fetch topic files with stored codes
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    WITH topic_files_by_log AS (
      SELECT 
        tltf.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'file_id', tf.file_id,
            'code', tf.code,
            'file_type', tf.type
          )
        ) as files
      FROM public.tutor_logs_topics_files tltf
      JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
      WHERE tltf.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tltf.tutor_log_id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, files)
    INTO v_topic_files
    FROM topic_files_by_log;
  END IF;

  RETURN jsonb_build_object(
    'tutorLogs', COALESCE(v_tutor_logs, '[]'::jsonb),
    'sessions', COALESCE(v_sessions, '{}'::jsonb),
    'sessionStudents', COALESCE(v_session_students, '{}'::jsonb),
    'sessionStaff', COALESCE(v_session_staff, '{}'::jsonb),
    'classesById', COALESCE(v_classes_by_id, '{}'::jsonb),
    'subjectsById', COALESCE(v_subjects_by_id, '{}'::jsonb),
    'staffAttendance', COALESCE(v_staff_attendance, '{}'::jsonb),
    'studentAttendance', COALESCE(v_student_attendance, '{}'::jsonb),
    'topics', COALESCE(v_topics, '{}'::jsonb),
    'topicFiles', COALESCE(v_topic_files, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_tutor_logs_admin IS 'Admin search function for tutor logs with filtering by session date (Adelaide timezone), searchable staff filter, and relationship loading. Fixed session_id extraction from JSONB array elements.';

