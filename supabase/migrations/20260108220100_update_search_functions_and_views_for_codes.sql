-- Migration: Update search functions and views to use stored codes
-- Description:
--   - Update search_topics_admin() to use stored code column instead of calculating
--   - Update search_tutor_logs_admin() to use stored code columns
--   - Add code columns to student and tutor views

-- ========================
-- PART 1: UPDATE SEARCH_TOPICS_ADMIN FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION search_topics_admin(
  -- Search
  p_search TEXT DEFAULT NULL,
  
  -- Filters
  p_subject_ids UUID[] DEFAULT NULL,
  
  -- Pagination
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
  v_search_like TEXT;
  v_topic_ids UUID[];
  v_topics JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('topics', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build topic ID list from search (if search provided)
  -- Now using stored code column instead of calculating
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT topic_id), ARRAY[]::UUID[])
    INTO v_topic_ids
    FROM (
      -- Search by subject shortname + topic code + topic name
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            t.code,
            t.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            t.code,
            t.name
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Search by subject longname + topic code + topic name
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            t.code,
            t.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            t.code,
            t.name
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Also search by individual fields for better coverage
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(COALESCE(t.name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(t.code, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level)) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          COALESCE(t.name, '') ILIKE v_search_like
          OR COALESCE(t.code, '') ILIKE v_search_like
          OR format_subject_short_name(s.curriculum::text, s.year_level, s.name) ILIKE v_search_like
          OR format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level) ILIKE v_search_like
        ))
      )
    ) search_results;
  END IF;

  -- Build main query with filters
  WITH filtered_topics AS (
    SELECT 
      t.id,
      t.subject_id,
      t.name,
      t.parent_id,
      t.index,
      t.code,
      t.created_at,
      t.updated_at,
      t.created_by,
      -- Subject info
      s.id AS subject_id_full,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE 
      -- Search filter: if search was provided, v_topic_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_topic_ids IS NULL (show all)
      (v_topic_ids IS NULL OR (array_length(v_topic_ids, 1) > 0 AND t.id = ANY(v_topic_ids)))
      -- Subject filter
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
  ),
  paginated_topics AS (
    SELECT *
    FROM filtered_topics
    ORDER BY 
      -- Sort by subject name alphabetically, then by topic index
      subject_name ASC,
      index ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
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
          'year_level', pt.year_level,
          'discipline', pt.discipline,
          'level', pt.level,
          'color', pt.color
        )
      )
    ),
    COUNT(*)
  INTO v_topics, v_total_count
  FROM paginated_topics pt;

  RETURN jsonb_build_object(
    'topics', COALESCE(v_topics, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- PART 2: UPDATE SEARCH_TUTOR_LOGS_ADMIN FUNCTION
-- ========================

-- Read the existing function to update it
-- We'll replace the recursive CTE code calculations with direct column access

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

  -- Collect session IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT session_id), ARRAY[]::UUID[])
  INTO v_session_ids
  FROM jsonb_array_elements(COALESCE(v_tutor_logs, '[]'::jsonb))
  WHERE (value->>'session_id')::uuid IS NOT NULL;

  -- Collect class IDs and subject IDs from sessions
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT 
      COALESCE(ARRAY_AGG(DISTINCT class_id), ARRAY[]::UUID[]),
      COALESCE(ARRAY_AGG(DISTINCT subject_id), ARRAY[]::UUID[])
    INTO v_class_ids, v_subject_ids
    FROM public.sessions
    WHERE id = ANY(v_session_ids);
  END IF;

  -- Fetch sessions
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, to_jsonb(s.*))
    INTO v_sessions
    FROM public.sessions s
    WHERE s.id = ANY(v_session_ids);
  END IF;

  -- Fetch session students
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(session_id::TEXT, students)
    INTO v_session_students
    FROM (
      SELECT 
        session_id,
        jsonb_agg(
          jsonb_build_object(
            'student_id', student_id,
            'attended', attended
          )
        ) as students
      FROM public.sessions_students
      WHERE session_id = ANY(v_session_ids)
      GROUP BY session_id
    ) ss;
  END IF;

  -- Fetch session staff
  IF v_session_ids IS NOT NULL AND array_length(v_session_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(session_id::TEXT, staff)
    INTO v_session_staff
    FROM (
      SELECT 
        session_id,
        jsonb_agg(
          jsonb_build_object(
            'staff_id', staff_id,
            'role', role,
            'attended', attended
          )
        ) as staff
      FROM public.sessions_staff
      WHERE session_id = ANY(v_session_ids)
      GROUP BY session_id
    ) ss;
  END IF;

  -- Fetch classes by ID
  IF v_class_ids IS NOT NULL AND array_length(v_class_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, to_jsonb(c.*))
    INTO v_classes_by_id
    FROM public.classes c
    WHERE c.id = ANY(v_class_ids);
  END IF;

  -- Fetch subjects by ID
  IF v_subject_ids IS NOT NULL AND array_length(v_subject_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(id::TEXT, to_jsonb(s.*))
    INTO v_subjects_by_id
    FROM public.subjects s
    WHERE s.id = ANY(v_subject_ids);
  END IF;

  -- Collect tutor log IDs
  SELECT COALESCE(ARRAY_AGG((value->>'id')::uuid), ARRAY[]::UUID[])
  INTO v_tutor_log_ids
  FROM jsonb_array_elements(COALESCE(v_tutor_logs, '[]'::jsonb));

  -- Fetch staff attendance
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(tutor_log_id::TEXT, staff)
    INTO v_staff_attendance
    FROM (
      SELECT 
        tlsa.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'staff_id', tlsa.staff_id,
            'attended', tlsa.attended
          )
        ) as staff
      FROM public.tutor_logs_staff_attendance tlsa
      WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tlsa.tutor_log_id
    ) sa;
  END IF;

  -- Fetch student attendance
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(tutor_log_id::TEXT, students)
    INTO v_student_attendance
    FROM (
      SELECT 
        tlts.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'student_id', tlts.student_id,
            'attended', tlts.attended
          )
        ) as students
      FROM public.tutor_logs_topics_students tlts
      WHERE tlts.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tlts.tutor_log_id
    ) sa;
  END IF;

  -- Fetch topics with stored codes (no calculation needed)
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(tutor_log_id::TEXT, topics)
    INTO v_topics
    FROM (
      SELECT 
        tlt.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'topic_id', t.id,
            'code', COALESCE(t.code, t.index::TEXT),
            'name', t.name
          )
        ) as topics
      FROM public.tutor_logs_topics tlt
      JOIN public.topics t ON t.id = tlt.topic_id
      WHERE tlt.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tlt.tutor_log_id
    ) topics_by_log;
  END IF;

  -- Fetch topic files with stored codes (no calculation needed)
  IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
    SELECT jsonb_object_agg(tutor_log_id::TEXT, files)
    INTO v_topic_files
    FROM (
      SELECT 
        tltf.tutor_log_id,
        jsonb_agg(
          jsonb_build_object(
            'file_id', tf.id,
            'code', COALESCE(tf.code, ''),
            'file_type', tf.type
          )
        ) as files
      FROM public.tutor_logs_topics_files tltf
      JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
      WHERE tltf.tutor_log_id = ANY(v_tutor_log_ids)
      GROUP BY tltf.tutor_log_id
    ) files_by_log;
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

-- ========================
-- PART 3: UPDATE VIEWS TO INCLUDE CODE COLUMNS
-- ========================

-- Update vstudent_topics view
DROP VIEW IF EXISTS public.vstudent_topics CASCADE;

CREATE OR REPLACE VIEW public.vstudent_topics
WITH (security_invoker = false)
AS
SELECT 
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
  t.code,
  t.created_at,
  t.updated_at,
  t.created_by
FROM public.topics t
WHERE t.subject_id IN (
  SELECT id FROM public.vstudent_subjects
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vstudent_topics TO authenticated;

COMMENT ON VIEW public.vstudent_topics IS 'Student view: All topics for authorized subjects';

-- Update vstudent_topics_files view
DROP VIEW IF EXISTS public.vstudent_topics_files CASCADE;

CREATE OR REPLACE VIEW public.vstudent_topics_files
WITH (security_invoker = false)
AS
SELECT 
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.code,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  -- File details
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (
  SELECT id FROM public.vstudent_topics
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vstudent_topics_files TO authenticated;

COMMENT ON VIEW public.vstudent_topics_files IS 'Student view: All topics_files with file details for authorized topics';

-- Update vtutor_topics view
DROP VIEW IF EXISTS public.vtutor_topics CASCADE;

CREATE OR REPLACE VIEW public.vtutor_topics
WITH (security_invoker = false)
AS
SELECT 
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
  t.code,
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

-- Update vtutor_topics_files view
DROP VIEW IF EXISTS public.vtutor_topics_files CASCADE;

CREATE OR REPLACE VIEW public.vtutor_topics_files
WITH (security_invoker = false)
AS
SELECT 
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.code,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  -- File details
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (
  SELECT id FROM public.vtutor_topics
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vtutor_topics_files TO authenticated;

COMMENT ON VIEW public.vtutor_topics_files IS 'Tutor view: All topics_files with file details for authorized topics';

