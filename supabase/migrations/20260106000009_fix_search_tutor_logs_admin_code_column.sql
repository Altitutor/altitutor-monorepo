-- Migration: Fix search_tutor_logs_admin function - calculate topic and topic file codes
-- Description: 
--   - Calculate topic codes using recursive CTE (traversing parent hierarchy)
--   - Calculate topic file codes using topic codes + resource type mappings
--   - Fix column references: topics_files_id (was topic_file_id), type (was file_type)
--   - Codes are computed values, not stored columns

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

  -- Convert date range from Adelaide timezone to UTC
  -- Adelaide is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
  -- We'll use AT TIME ZONE to convert properly
  IF p_range_start IS NOT NULL THEN
    -- Start of day in Adelaide (00:00:00 Adelaide time)
    v_range_start_utc := (p_range_start::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
  END IF;
  
  IF p_range_end IS NOT NULL THEN
    -- End of day in Adelaide (23:59:59.999 Adelaide time)
    v_range_end_utc := (p_range_end::TEXT || ' 23:59:59.999')::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
  END IF;

  -- Step 1: Find staff IDs by search (if search provided)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_staff_ids
    FROM (
      -- Search by staff names (exact + fuzzy matching)
      SELECT id
      FROM public.staff
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
    ) search_results;
  END IF;

  -- Step 2: Build filtered tutor logs query
  WITH filtered_tutor_logs AS (
    SELECT 
      tl.id,
      tl.session_id,
      tl.created_by,
      tl.created_at,
      s.start_at as session_start_at,
      s.end_at as session_end_at,
      s.type as session_type,
      s.class_id,
      s.subject_id
    FROM public.tutor_logs tl
    JOIN public.sessions s ON s.id = tl.session_id
    WHERE 
      -- Search filter: if search was provided, filter by staff who created or attended
      (v_staff_ids IS NULL OR (array_length(v_staff_ids, 1) > 0 AND (
        tl.created_by = ANY(v_staff_ids)
        OR EXISTS (
          SELECT 1 FROM public.tutor_logs_staff_attendance tlsa
          WHERE tlsa.tutor_log_id = tl.id AND tlsa.staff_id = ANY(v_staff_ids)
        )
      )))
      -- Date range filter: filter by session date (Adelaide timezone)
      AND (v_range_start_utc IS NULL OR s.start_at >= v_range_start_utc)
      AND (v_range_end_utc IS NULL OR s.start_at <= v_range_end_utc)
      -- Staff filter
      AND (p_staff_id IS NULL OR (
        tl.created_by = p_staff_id
        OR EXISTS (
          SELECT 1 FROM public.tutor_logs_staff_attendance tlsa
          WHERE tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id
        )
      ))
  ),
  ordered_tutor_logs AS (
    SELECT *
    FROM filtered_tutor_logs
    ORDER BY
      CASE WHEN p_order_by = 'session_start_at' AND p_ascending THEN session_start_at END ASC,
      CASE WHEN p_order_by = 'session_start_at' AND NOT p_ascending THEN session_start_at END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      -- Default to session_start_at DESC if order_by doesn't match
      session_start_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'session_id', session_id,
        'created_by', created_by,
        'created_at', created_at,
        'session_start_at', session_start_at,
        'session_end_at', session_end_at,
        'session_type', session_type,
        'class_id', class_id,
        'subject_id', subject_id
      )
    ),
    COUNT(*) OVER()::BIGINT
  INTO v_tutor_logs, v_total_count
  FROM ordered_tutor_logs;

  -- Early return if no tutor logs
  IF v_tutor_logs IS NULL OR jsonb_array_length(v_tutor_logs) = 0 THEN
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

  -- Extract tutor log IDs and session IDs for relationship queries
  SELECT 
    ARRAY_AGG((tl->>'id')::UUID),
    ARRAY_AGG((tl->>'session_id')::UUID)
  INTO v_tutor_log_ids, v_session_ids
  FROM jsonb_array_elements(v_tutor_logs) tl;

  -- Step 3: Fetch relationships
  -- Get class IDs and subject IDs from sessions
  SELECT 
    ARRAY_AGG(DISTINCT (tl->>'class_id')::UUID) FILTER (WHERE (tl->>'class_id') IS NOT NULL),
    ARRAY_AGG(DISTINCT (tl->>'subject_id')::UUID) FILTER (WHERE (tl->>'subject_id') IS NOT NULL)
  INTO v_class_ids, v_subject_ids
  FROM jsonb_array_elements(v_tutor_logs) tl;

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
            'role', stf.role,
            'status', stf.status,
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

  -- Fetch staff attendance (actual attendance from tutor logs)
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    WITH staff_attendance_by_log AS (
      SELECT 
        tl.id as tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'staff_id', stf.id,
            'first_name', stf.first_name,
            'last_name', stf.last_name,
            'role', stf.role,
            'attended', tlsa.attended,
            'type', tlsa.type
          )
        ) as attendance
      FROM public.tutor_logs_staff_attendance tlsa
      JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
      JOIN public.staff stf ON stf.id = tlsa.staff_id
      WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tl.id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, attendance)
    INTO v_staff_attendance
    FROM staff_attendance_by_log;
  END IF;

  -- Fetch student attendance (actual attendance from tutor logs)
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

  -- Fetch topics with calculated codes
  -- FIXED: Calculate topic codes using recursive CTE (similar to search_topics_admin)
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    -- First, get all unique topic IDs from tutor logs, then calculate codes recursively
    WITH RECURSIVE tutor_log_topics AS (
      SELECT DISTINCT tlt.topic_id
      FROM public.tutor_logs_topics tlt
      WHERE tlt.tutor_log_id = ANY(v_tutor_log_ids)
    ),
    topic_codes AS (
      -- Base case: root topics (no parent)
      SELECT 
        t.id,
        t.index::TEXT AS code,
        t.parent_id,
        t.subject_id
      FROM public.topics t
      WHERE t.id IN (SELECT topic_id FROM tutor_log_topics)
        AND t.parent_id IS NULL
      
      UNION ALL
      
      -- Recursive case: child topics
      SELECT 
        t.id,
        tc.code || '.' || t.index::TEXT AS code,
        t.parent_id,
        t.subject_id
      FROM public.topics t
      JOIN topic_codes tc ON t.parent_id = tc.id
      WHERE t.id IN (SELECT topic_id FROM tutor_log_topics)
    ),
    topics_by_log AS (
      SELECT 
        tlt.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'topic_id', t.id,
            'code', COALESCE(tc.code, t.index::TEXT),
            'name', t.name
          )
        ) as topics
      FROM public.tutor_logs_topics tlt
      JOIN public.topics t ON t.id = tlt.topic_id
      LEFT JOIN topic_codes tc ON tc.id = t.id
      WHERE tlt.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tlt.tutor_log_id
    )
    SELECT jsonb_object_agg(tutor_log_id::TEXT, topics)
    INTO v_topics
    FROM topics_by_log;
  END IF;

  -- Fetch topic files with calculated codes
  -- FIXED: Calculate topic file codes using topic codes and resource type mappings
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    -- Get topic IDs from topic files, then calculate codes recursively
    WITH RECURSIVE tutor_log_topic_files AS (
      SELECT DISTINCT tf.topic_id
      FROM public.tutor_logs_topics_files tltf
      JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
      WHERE tltf.tutor_log_id = ANY(v_tutor_log_ids)
    ),
    topic_codes_for_files AS (
      -- Base case: root topics (no parent)
      SELECT 
        t.id,
        t.index::TEXT AS code,
        t.parent_id
      FROM public.topics t
      WHERE t.id IN (SELECT topic_id FROM tutor_log_topic_files)
        AND t.parent_id IS NULL
      
      UNION ALL
      
      -- Recursive case: child topics
      SELECT 
        t.id,
        tc.code || '.' || t.index::TEXT AS code,
        t.parent_id
      FROM public.topics t
      JOIN topic_codes_for_files tc ON t.parent_id = tc.id
      WHERE t.id IN (SELECT topic_id FROM tutor_log_topic_files)
    ),
    -- Map resource_type enum to code abbreviations
    resource_type_codes AS (
      SELECT 'NOTES'::text AS type, 'N'::text AS code
      UNION ALL SELECT 'PRACTICE_QUESTIONS', 'PQ'
      UNION ALL SELECT 'TEST', 'T'
      UNION ALL SELECT 'VIDEO', 'V'
      UNION ALL SELECT 'EXAM', 'E'
      UNION ALL SELECT 'REVISION_SHEET', 'RS'
      UNION ALL SELECT 'CHEAT_SHEET', 'CS'
      UNION ALL SELECT 'FLASHCARDS', 'F'
    ),
    topic_files_by_log AS (
      SELECT 
        tltf.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'file_id', tf.id,
            'code', 
              COALESCE(tc.code, t.index::TEXT) || 
              COALESCE(rtc.code, '') || 
              '.' || tf.index::TEXT ||
              CASE WHEN tf.is_solutions THEN '_SOL' ELSE '' END,
            'file_type', tf.type
          )
        ) as files
      FROM public.tutor_logs_topics_files tltf
      JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
      JOIN public.topics t ON t.id = tf.topic_id
      LEFT JOIN topic_codes_for_files tc ON tc.id = t.id
      LEFT JOIN resource_type_codes rtc ON rtc.type = tf.type::text
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

GRANT EXECUTE ON FUNCTION search_tutor_logs_admin TO authenticated;

COMMENT ON FUNCTION search_tutor_logs_admin IS 'Admin search function for tutor logs with filtering by session date (Adelaide timezone), searchable staff filter, and relationship loading.';

