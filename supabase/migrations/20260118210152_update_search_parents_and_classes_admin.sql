-- Migration: Update search_parents_admin and search_classes_admin functions
-- Description:
--   1. Modify search_parents_admin: Remove email and phone search completely (name-only search)
--   2. Modify search_classes_admin: Add separate parameters to exclude student/staff search
--      - p_exclude_student_search BOOLEAN DEFAULT FALSE
--      - p_exclude_staff_search BOOLEAN DEFAULT FALSE

-- ========================
-- UPDATE SEARCH_PARENTS_ADMIN FUNCTION
-- ========================
-- Remove email and phone search completely - only search by names

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
  v_search_like TEXT;
  v_parent_ids UUID[];
  v_parents JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('parents', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build parent ID list from search
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_parent_ids
    FROM (
      -- Search by parent names (exact + fuzzy matching) - NO email/phone search
      SELECT id
      FROM parents
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
      
      UNION
      
      -- Search by linked student names (exact + fuzzy matching)
      SELECT DISTINCT ps.parent_id
      FROM parents_students ps
      JOIN students s ON s.id = ps.student_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, '')) ILIKE v_search_like
           OR COALESCE(s.first_name, '') ILIKE v_search_like
           OR COALESCE(s.last_name, '') ILIKE v_search_like
         ))
    ) search_results;
  END IF;

  -- Build main query
  WITH filtered_parents AS (
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.created_at,
      p.updated_at
    FROM parents p
    WHERE (v_parent_ids IS NULL OR (array_length(v_parent_ids, 1) > 0 AND p.id = ANY(v_parent_ids)))
  ),
  paginated_parents AS (
    SELECT *
    FROM filtered_parents
    ORDER BY 
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'email' AND p_ascending THEN email END ASC,
      CASE WHEN p_order_by = 'email' AND NOT p_ascending THEN email END DESC,
      last_name ASC  -- Default fallback
    LIMIT p_limit
    OFFSET p_offset
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

  -- Build result
  RETURN jsonb_build_object(
    'parents', COALESCE(v_parents, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_parents_admin IS 'Admin search function for parents with exact + fuzzy name matching and linked student name search. Email and phone search removed - name-only search. Returns phone and email fields.';

-- ========================
-- UPDATE SEARCH_CLASSES_ADMIN FUNCTION
-- ========================
-- Add separate parameters to exclude student/staff search

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
  v_search_like TEXT;
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

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT class_id), ARRAY[]::UUID[])
    INTO v_class_ids
    FROM (
      -- Search by full formatted class names (exact + fuzzy matching)
      SELECT DISTINCT c.id AS class_id
      FROM classes c
      JOIN subjects subj ON subj.id = c.subject_id
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
      
      UNION
      
      -- Search by subject shortname + day + time (concatenated)
      SELECT DISTINCT c.id AS class_id
      FROM classes c
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name),
            format_day_short_name(c.day_of_week),
            TO_CHAR(c.start_time::time, 'HH12:MI AM')
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name),
            format_day_short_name(c.day_of_week),
            TO_CHAR(c.start_time::time, 'HH12:MI AM')
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Search by subject longname + day + time (concatenated)
      SELECT DISTINCT c.id AS class_id
      FROM classes c
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level),
            format_day_short_name(c.day_of_week),
            TO_CHAR(c.start_time::time, 'HH12:MI AM')
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level),
            format_day_short_name(c.day_of_week),
            TO_CHAR(c.start_time::time, 'HH12:MI AM')
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Search by individual components for partial matching
      SELECT DISTINCT c.id AS class_id
      FROM classes c
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE (
        -- Subject shortname
        LOWER(format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level)) LIKE '%' || v_search_lower || '%'
        -- Day (short)
        OR LOWER(format_day_short_name(c.day_of_week)) LIKE '%' || v_search_lower || '%'
        -- Day (full)
        OR LOWER(format_day_full_name(c.day_of_week)) LIKE '%' || v_search_lower || '%'
        -- Time
        OR LOWER(TO_CHAR(c.start_time::time, 'HH12:MI AM')) LIKE '%' || v_search_lower || '%'
        OR LOWER(TO_CHAR(c.end_time::time, 'HH12:MI AM')) LIKE '%' || v_search_lower || '%'
        -- Fuzzy matching
        OR (v_search_like IS NOT NULL AND (
          format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name) ILIKE v_search_like
          OR format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level) ILIKE v_search_like
          OR format_day_short_name(c.day_of_week) ILIKE v_search_like
          OR format_day_full_name(c.day_of_week) ILIKE v_search_like
          OR TO_CHAR(c.start_time::time, 'HH12:MI AM') ILIKE v_search_like
          OR TO_CHAR(c.end_time::time, 'HH12:MI AM') ILIKE v_search_like
        ))
      )
      
      -- Only include student search if p_exclude_student_search is FALSE
      UNION ALL
      SELECT DISTINCT cs.class_id
      FROM classes_students cs
      JOIN students st ON st.id = cs.student_id
      WHERE cs.unenrolled_at IS NULL
        AND NOT p_exclude_student_search
        AND (
          LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
          ))
        )
      
      -- Only include staff search if p_exclude_staff_search is FALSE
      UNION ALL
      SELECT DISTINCT cs.class_id
      FROM classes_staff cs
      JOIN staff st ON st.id = cs.staff_id
      WHERE cs.unassigned_at IS NULL
        AND NOT p_exclude_staff_search
        AND (
          LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
          ))
        )
    ) search_results;
  END IF;

  WITH filtered_classes AS (
    SELECT 
      c.id,
      c.day_of_week,
      c.start_time,
      c.end_time,
      c.status,
      c.room,
      c.subject_id,
      c.level
    FROM classes c
    WHERE (v_class_ids IS NULL OR (array_length(v_class_ids, 1) > 0 AND c.id = ANY(v_class_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR c.status = ANY(p_statuses))
      -- Filter by subject_ids: class must have one of the specified subject(s)
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR c.subject_id = ANY(p_subject_ids))
  ),
  paginated_classes AS (
    SELECT *
    FROM filtered_classes
    ORDER BY 
      CASE WHEN p_order_by = 'day_of_week' AND p_ascending THEN day_of_week END ASC,
      CASE WHEN p_order_by = 'day_of_week' AND NOT p_ascending THEN day_of_week END DESC,
      CASE WHEN p_order_by = 'start_time' AND p_ascending THEN start_time END ASC,
      CASE WHEN p_order_by = 'start_time' AND NOT p_ascending THEN start_time END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      day_of_week ASC, start_time ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', pc.id,
        'day_of_week', pc.day_of_week,
        'start_time', pc.start_time::TEXT,
        'end_time', pc.end_time::TEXT,
        'status', pc.status,
        'room', pc.room,
        'subject_id', pc.subject_id,
        'level', pc.level
      )
    ),
    (SELECT COUNT(*) FROM filtered_classes)
  INTO v_classes, v_total_count
  FROM paginated_classes pc;

  IF p_include_relationships AND v_classes IS NOT NULL THEN
    WITH class_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_classes) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      ci.id::TEXT,
      jsonb_build_object(
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
    INTO v_class_subjects
    FROM class_ids ci
    JOIN classes c ON c.id = ci.id
    LEFT JOIN subjects subj ON subj.id = c.subject_id;

    WITH class_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_classes) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      ci.id::TEXT,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', st.id,
              'first_name', st.first_name,
              'last_name', st.last_name,
              'status', st.status,
              'curriculum', st.curriculum,
              'year_level', st.year_level,
              'school', st.school
            )
            ORDER BY st.last_name, st.first_name
          ),
          '[]'::jsonb
        )
        FROM classes_students cs
        JOIN students st ON st.id = cs.student_id
        WHERE cs.class_id = ci.id AND cs.unenrolled_at IS NULL
      )
    )
    INTO v_class_students
    FROM class_ids ci;

    WITH class_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_classes) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      ci.id::TEXT,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', st.id,
              'first_name', st.first_name,
              'last_name', st.last_name,
              'role', st.role,
              'status', st.status,
              'email', st.email,
              'phone_number', st.phone_number
            )
            ORDER BY st.last_name, st.first_name
          ),
          '[]'::jsonb
        )
        FROM classes_staff cs
        JOIN staff st ON st.id = cs.staff_id
        WHERE cs.class_id = ci.id AND cs.unassigned_at IS NULL
      )
    )
    INTO v_class_staff
    FROM class_ids ci;
  END IF;

  RETURN jsonb_build_object(
    'classes', COALESCE(v_classes, '[]'::jsonb),
    'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb),
    'classStudents', COALESCE(v_class_students, '{}'::jsonb),
    'classStaff', COALESCE(v_class_staff, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_classes_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for classes with exact + fuzzy matching on class names and partial component matching (subject shortname/longname, day short/full, time) in any order. Optional student/staff name search (can be excluded via p_exclude_student_search and p_exclude_staff_search). Fixed to return empty results when search matches nothing. Supports filtering by subject_ids. Returns subjects with short_name and long_name fields.';
