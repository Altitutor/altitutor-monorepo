-- Migration: Add admin_shift_id support to search_sessions_admin RPC function
-- Description:
--   - Add p_admin_shift_id parameter to filter sessions by admin shift
--   - Include admin_shift_id in returned session objects
--   - Add filter condition in WHERE clause

-- ========================
-- DROP OLD FUNCTION (if exists with old signature)
-- ========================
-- Drop the old function signature (without p_admin_shift_id) if it exists
-- This ensures we don't have duplicate functions with different signatures
DROP FUNCTION IF EXISTS search_sessions_admin(
  TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN
);

-- ========================
-- UPDATE SEARCH_SESSIONS_ADMIN FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION search_sessions_admin(
  -- Search & Filters
  p_search TEXT DEFAULT NULL,
  p_range_start TIMESTAMPTZ DEFAULT NULL,
  p_range_end TIMESTAMPTZ DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  p_admin_shift_id UUID DEFAULT NULL,
  
  -- Status & Type
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_types TEXT[] DEFAULT NULL,
  
  -- Relationships
  p_include_relationships BOOLEAN DEFAULT TRUE,
  
  -- Pagination
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  
  -- Ordering
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
  v_search_like TEXT;
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

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Step 1: Find session IDs by search (if search provided)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_session_ids
    FROM (
      -- Search by student names (exact + fuzzy matching)
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_students ss ON ss.session_id = s.id
      JOIN public.students st ON st.id = ss.student_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
           OR COALESCE(st.first_name, '') ILIKE v_search_like
           OR COALESCE(st.last_name, '') ILIKE v_search_like
         ))
      
      UNION
      
      -- Search by staff names (exact + fuzzy matching)
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_staff sf ON sf.session_id = s.id
      JOIN public.staff stf ON stf.id = sf.staff_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(stf.first_name, ''), COALESCE(stf.last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(stf.first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(stf.last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(stf.first_name, ''), COALESCE(stf.last_name, '')) ILIKE v_search_like
           OR COALESCE(stf.first_name, '') ILIKE v_search_like
           OR COALESCE(stf.last_name, '') ILIKE v_search_like
         ))
      
      UNION
      
      -- Search by session shortname (class shortname/longname) - exact + fuzzy matching
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.classes c ON c.id = s.class_id
      JOIN public.subjects subj ON subj.id = c.subject_id
      WHERE (
        LOWER(format_class_short_name(
          c.day_of_week,
          c.start_time::time,
          subj.curriculum::text,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_class_full_name(
          c.day_of_week,
          c.start_time::time,
          c.end_time::time,
          subj.curriculum::text,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          format_class_short_name(
            c.day_of_week,
            c.start_time::time,
            subj.curriculum::text,
            subj.year_level,
            subj.name
          ) ILIKE v_search_like
          OR format_class_full_name(
            c.day_of_week,
            c.start_time::time,
            c.end_time::time,
            subj.curriculum::text,
            subj.year_level,
            subj.name
          ) ILIKE v_search_like
        ))
      )
    ) search_results;
  END IF;

  -- Step 2: Build filtered sessions query with all filters
  WITH filtered_sessions AS (
    SELECT 
      s.id,
      s.type,
      s.class_id,
      s.subject_id,
      s.admin_shift_id,
      s.start_at,
      s.end_at,
      s.status,
      s.created_at,
      s.updated_at
    FROM public.sessions s
    WHERE 
      -- Search filter: if search was provided, v_session_ids will be empty array (not NULL) when no matches
      (v_session_ids IS NULL OR (array_length(v_session_ids, 1) > 0 AND s.id = ANY(v_session_ids)))
      -- Date range filter
      AND (p_range_start IS NULL OR s.start_at >= p_range_start)
      AND (p_range_end IS NULL OR s.start_at <= p_range_end)
      -- Staff filter
      AND (p_staff_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sessions_staff sf 
        WHERE sf.session_id = s.id AND sf.staff_id = p_staff_id
      ))
      -- Class filter
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      -- Student filter
      AND (p_student_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sessions_students ss 
        WHERE ss.session_id = s.id AND ss.student_id = p_student_id
      ))
      -- Admin shift filter
      AND (p_admin_shift_id IS NULL OR s.admin_shift_id = p_admin_shift_id)
      -- Status filter
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      -- Type filter (cast enum to text for comparison)
      AND (p_types IS NULL OR array_length(p_types, 1) IS NULL OR s.type::text = ANY(p_types))
  ),
  ordered_sessions AS (
    SELECT *
    FROM filtered_sessions
    ORDER BY
      CASE WHEN p_order_by = 'start_at' AND p_ascending THEN start_at END ASC,
      CASE WHEN p_order_by = 'start_at' AND NOT p_ascending THEN start_at END DESC,
      CASE WHEN p_order_by = 'end_at' AND p_ascending THEN end_at END ASC,
      CASE WHEN p_order_by = 'end_at' AND NOT p_ascending THEN end_at END DESC,
      CASE WHEN p_order_by = 'type' AND p_ascending THEN type END ASC,
      CASE WHEN p_order_by = 'type' AND NOT p_ascending THEN type END DESC,
      CASE WHEN p_order_by = 'class_id' AND p_ascending THEN class_id END ASC,
      CASE WHEN p_order_by = 'class_id' AND NOT p_ascending THEN class_id END DESC,
      -- Default to start_at ASC if order_by doesn't match
      start_at ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', type,
        'class_id', class_id,
        'subject_id', subject_id,
        'admin_shift_id', admin_shift_id,
        'start_at', start_at,
        'end_at', end_at,
        'status', status,
        'created_at', created_at,
        'updated_at', updated_at
      )
    ),
    COUNT(*) OVER()::BIGINT
  INTO v_sessions, v_total_count
  FROM ordered_sessions;

  -- Early return if no sessions
  IF v_sessions IS NULL OR jsonb_array_length(v_sessions) = 0 THEN
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

  -- Extract session IDs for relationship queries
  SELECT ARRAY_AGG((s->>'id')::UUID)
  INTO v_session_ids
  FROM jsonb_array_elements(v_sessions) s;

  -- Step 3: Fetch relationships if requested
  IF p_include_relationships THEN
    -- Get class IDs and subject IDs from sessions
    SELECT 
      ARRAY_AGG(DISTINCT (s->>'class_id')::UUID) FILTER (WHERE (s->>'class_id') IS NOT NULL),
      ARRAY_AGG(DISTINCT (s->>'subject_id')::UUID) FILTER (WHERE (s->>'subject_id') IS NOT NULL)
    INTO v_class_ids, v_subject_ids
    FROM jsonb_array_elements(v_sessions) s;

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

    -- Get tutor log IDs for fetching actual attendance
    SELECT ARRAY_AGG(id)
    INTO v_tutor_log_ids
    FROM public.tutor_logs
    WHERE session_id = ANY(v_session_ids);

    -- Build actual attendance maps (session_id -> student_id/staff_id -> attended)
    -- We'll use these to enrich planned attendance data
    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      -- Build student attendance map using CTE to avoid nested aggregates
      WITH student_attendance_by_session AS (
        SELECT 
          tl.session_id,
          jsonb_object_agg(student_id::TEXT, attended) as attendance_map
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map)
      INTO v_actual_student_attendance
      FROM student_attendance_by_session;

      -- Build staff attendance map using CTE to avoid nested aggregates
      WITH staff_attendance_by_session AS (
        SELECT 
          tl.session_id,
          jsonb_object_agg(staff_id::TEXT, attended) as attendance_map
        FROM public.tutor_logs_staff_attendance tlsf
        JOIN public.tutor_logs tl ON tl.id = tlsf.tutor_log_id
        WHERE tlsf.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map)
      INTO v_actual_staff_attendance
      FROM staff_attendance_by_session;
    END IF;

    -- Fetch planned session students with invoice status and merge with actual attendance
    -- FIX: Use DISTINCT ON to prevent duplicates when multiple invoice items exist
    WITH invoice_status_per_student AS (
      SELECT DISTINCT ON (ii.sessions_students_id)
        ii.sessions_students_id,
        inv.status as invoice_status
      FROM public.invoice_items ii
      JOIN public.invoices inv ON inv.id = ii.invoice_id
      WHERE ii.sessions_students_id IN (
        SELECT id FROM public.sessions_students WHERE session_id = ANY(v_session_ids)
      )
      ORDER BY ii.sessions_students_id, inv.created_at DESC
    ),
    session_students_with_invoice AS (
      SELECT 
        ss.session_id,
        ss.id as sessions_students_id,
        st.id as student_id,
        st.first_name,
        st.last_name,
        st.status,
        st.curriculum,
        st.year_level,
        st.school,
        COALESCE(ss.planned_absence, false) as planned_absence,
        COALESCE(
          (v_actual_student_attendance->ss.session_id::TEXT->st.id::TEXT)::boolean,
          NULL
        ) as actual_attended,
        COALESCE(iss.invoice_status, NULL) as invoice_status,
        -- Calculate is_extra: student is extra if session has class_id but student is not enrolled
        CASE 
          WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
          ELSE false
        END as is_extra
      FROM public.sessions_students ss
      JOIN public.students st ON st.id = ss.student_id
      JOIN public.sessions s ON s.id = ss.session_id
      LEFT JOIN invoice_status_per_student iss ON iss.sessions_students_id = ss.id
      LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id 
        AND cs.student_id = ss.student_id 
        AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      WHERE ss.session_id = ANY(v_session_ids)
    ),
    session_students_aggregated AS (
      SELECT 
        session_id,
        jsonb_agg(
          jsonb_build_object(
            'id', student_id,
            'first_name', first_name,
            'last_name', last_name,
            'status', status,
            'curriculum', curriculum,
            'year_level', year_level,
            'school', school,
            'planned_absence', planned_absence,
            'actual_attended', actual_attended,
            'sessions_students_id', sessions_students_id,
            'invoice_status', invoice_status,
            'is_extra', is_extra
          )
        ) as students
      FROM session_students_with_invoice
      GROUP BY session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, students)
    INTO v_session_students
    FROM session_students_aggregated;

    -- Add unplanned students (attended but not in sessions_students)
    -- Fixed: Split into separate CTEs to avoid nested aggregates
    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH unplanned_students AS (
        SELECT DISTINCT
          tl.session_id,
          tlsa.student_id,
          tlsa.attended
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tl.session_id = ANY(v_session_ids)
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_students ss
            WHERE ss.session_id = tl.session_id AND ss.student_id = tlsa.student_id
          )
      ),
      unplanned_student_details AS (
        SELECT 
          us.session_id,
          st.id,
          st.first_name,
          st.last_name,
          st.status,
          st.curriculum,
          st.year_level,
          st.school,
          us.attended,
          -- Calculate is_extra: student is extra if session has class_id but student is not enrolled
          CASE 
            WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
            ELSE false
          END as is_extra
        FROM unplanned_students us
        JOIN public.students st ON st.id = us.student_id
        JOIN public.sessions s ON s.id = us.session_id
        LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id 
          AND cs.student_id = us.student_id 
          AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      ),
      unplanned_students_aggregated AS (
        SELECT 
          session_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'first_name', first_name,
              'last_name', last_name,
              'status', status,
              'curriculum', curriculum,
              'year_level', year_level,
              'school', school,
              'planned_absence', true, -- Not in planned, so mark as absent
              'actual_attended', attended,
              'sessions_students_id', NULL,
              'invoice_status', NULL,
              'is_extra', is_extra
            )
          ) as students
        FROM unplanned_student_details
        GROUP BY session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, students)
      INTO v_unplanned_student_ids
      FROM unplanned_students_aggregated;

      -- Merge unplanned students into session_students
      IF v_unplanned_student_ids IS NOT NULL THEN
        SELECT jsonb_object_agg(
          k,
          COALESCE(v_session_students->k, '[]'::jsonb) || COALESCE(v_unplanned_student_ids->k, '[]'::jsonb)
        )
        INTO v_session_students
        FROM (
          SELECT DISTINCT k FROM jsonb_object_keys(COALESCE(v_session_students, '{}'::jsonb) || COALESCE(v_unplanned_student_ids, '{}'::jsonb)) k
        ) all_keys;
      END IF;
    END IF;

    -- Fetch planned session staff and merge with actual attendance
    -- ADDED: Include is_swapped_in flag - a staff member is swapped-in if their sessions_staff.id 
    -- is referenced by another sessions_staff.swapped_sessions_staff_id
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
            'planned_absence', COALESCE(sf.planned_absence, false),
            'actual_attended', COALESCE(
              (v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT)::boolean,
              NULL
            ),
            -- Check if this staff member is swapped-in (their sessions_staff.id is referenced by another record's swapped_sessions_staff_id)
            'is_swapped_in', EXISTS (
              SELECT 1 
              FROM public.sessions_staff other_sf
              WHERE other_sf.swapped_sessions_staff_id = sf.id
            )
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

    -- Add unplanned staff (attended but not in sessions_staff)
    -- Fixed: Split into separate CTEs to avoid nested aggregates
    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH unplanned_staff AS (
        SELECT DISTINCT
          tl.session_id,
          tlsf.staff_id,
          tlsf.attended
        FROM public.tutor_logs_staff_attendance tlsf
        JOIN public.tutor_logs tl ON tl.id = tlsf.tutor_log_id
        WHERE tl.session_id = ANY(v_session_ids)
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_staff sf
            WHERE sf.session_id = tl.session_id AND sf.staff_id = tlsf.staff_id
          )
      ),
      unplanned_staff_details AS (
        SELECT 
          us.session_id,
          stf.id,
          stf.first_name,
          stf.last_name,
          stf.role,
          stf.status,
          us.attended
        FROM unplanned_staff us
        JOIN public.staff stf ON stf.id = us.staff_id
      ),
      unplanned_staff_aggregated AS (
        SELECT 
          session_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'first_name', first_name,
              'last_name', last_name,
              'role', role,
              'status', status,
              'planned_absence', true, -- Not in planned, so mark as absent
              'actual_attended', attended,
              'is_swapped_in', false -- Unplanned staff are not swapped-in
            )
          ) as staff
        FROM unplanned_staff_details
        GROUP BY session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, staff)
      INTO v_unplanned_staff_ids
      FROM unplanned_staff_aggregated;

      -- Merge unplanned staff into session_staff
      IF v_unplanned_staff_ids IS NOT NULL THEN
        SELECT jsonb_object_agg(
          k,
          COALESCE(v_session_staff->k, '[]'::jsonb) || COALESCE(v_unplanned_staff_ids->k, '[]'::jsonb)
        )
        INTO v_session_staff
        FROM (
          SELECT DISTINCT k FROM jsonb_object_keys(COALESCE(v_session_staff, '{}'::jsonb) || COALESCE(v_unplanned_staff_ids, '{}'::jsonb)) k
        ) all_keys;
      END IF;
    END IF;

    -- Fetch tutor logs
    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH tutor_logs_with_creator AS (
        SELECT 
          tl.session_id,
          jsonb_build_object(
            'id', tl.id,
            'created_by', tl.created_by,
            'created_by_name', jsonb_build_object(
              'first_name', COALESCE(stf.first_name, ''),
              'last_name', COALESCE(stf.last_name, '')
            )
          ) as log_data
        FROM public.tutor_logs tl
        LEFT JOIN public.staff stf ON stf.id = tl.created_by
        WHERE tl.id = ANY(v_tutor_log_ids)
      )
      SELECT jsonb_object_agg(session_id::TEXT, log_data)
      INTO v_tutor_logs
      FROM tutor_logs_with_creator;
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

COMMENT ON FUNCTION search_sessions_admin(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Search and filter sessions with relationships. Supports filtering by admin_shift_id, class_id, staff_id, student_id, date range, status, and type. Returns sessions with students, staff, tutor logs, classes, and subjects.';
