-- Migration: Fix empty search results in all search RPC functions
-- Description:
--   - Fix issue where search terms that match nothing return all results instead of empty
--   - Problem: When ARRAY_AGG gets no rows, it returns NULL
--   - When v_*_ids IS NULL, the WHERE clause (v_*_ids IS NULL OR s.id = ANY(v_*_ids)) evaluates to TRUE for all rows
--   - Solution: Use COALESCE to convert NULL to empty array when search was provided but matches nothing
--   - This distinguishes between "no search" (show all) vs "search with no matches" (show empty)

-- ========================
-- FIX SEARCH_SUBJECTS_ADMIN
-- ========================

CREATE OR REPLACE FUNCTION search_subjects_admin(
  -- Search
  p_search TEXT DEFAULT NULL,
  
  -- Filters
  p_year_levels INTEGER[] DEFAULT NULL,
  p_curriculums TEXT[] DEFAULT NULL,
  p_disciplines TEXT[] DEFAULT NULL,
  p_levels TEXT[] DEFAULT NULL,
  
  -- Pagination
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  
  -- Ordering
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
  v_search_like TEXT;
  v_subject_ids UUID[];
  v_subjects JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('subjects', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build subject ID list from search (if search provided)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_subject_ids
    FROM (
      -- Search by subject shortname (exact + fuzzy matching)
      SELECT id
      FROM subjects
      WHERE LOWER(format_subject_short_name(
        curriculum::text,
        year_level,
        name
      )) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           format_subject_short_name(
             curriculum::text,
             year_level,
             name
           ) ILIKE v_search_like
         ))
      
      UNION
      
      -- Search by subject longname (exact + fuzzy matching)
      SELECT id
      FROM subjects
      WHERE LOWER(format_subject_long_name(
        curriculum::text,
        year_level,
        name,
        level
      )) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           format_subject_long_name(
             curriculum::text,
             year_level,
             name,
             level
           ) ILIKE v_search_like
         ))
      
      UNION
      
      -- Also search by individual fields for better coverage
      SELECT id
      FROM subjects
      WHERE LOWER(COALESCE(name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(curriculum::text, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(level, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           COALESCE(name, '') ILIKE v_search_like
           OR COALESCE(curriculum::text, '') ILIKE v_search_like
           OR COALESCE(level, '') ILIKE v_search_like
         ))
    ) search_results;
  END IF;

  -- Build main query with filters
  WITH filtered_subjects AS (
    SELECT 
      s.id,
      s.name,
      s.curriculum,
      s.year_level,
      s.discipline,
      s.level,
      s.color,
      s.created_at,
      s.updated_at
    FROM subjects s
    WHERE 
      -- Search filter: if search was provided, v_subject_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_subject_ids IS NULL (show all)
      (v_subject_ids IS NULL OR (array_length(v_subject_ids, 1) > 0 AND s.id = ANY(v_subject_ids)))
      -- Year level filter
      AND (p_year_levels IS NULL OR array_length(p_year_levels, 1) IS NULL OR s.year_level = ANY(p_year_levels))
      -- Curriculum filter
      AND (p_curriculums IS NULL OR array_length(p_curriculums, 1) IS NULL OR s.curriculum::text = ANY(p_curriculums))
      -- Discipline filter
      AND (p_disciplines IS NULL OR array_length(p_disciplines, 1) IS NULL OR s.discipline::text = ANY(p_disciplines))
      -- Level filter
      AND (p_levels IS NULL OR array_length(p_levels, 1) IS NULL OR s.level = ANY(p_levels))
  ),
  paginated_subjects AS (
    SELECT *
    FROM filtered_subjects
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
      name ASC  -- Default fallback
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'name', ps.name,
        'curriculum', ps.curriculum,
        'year_level', ps.year_level,
        'discipline', ps.discipline,
        'level', ps.level,
        'color', ps.color,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at
      )
    ),
    COUNT(*)
  INTO v_subjects, v_total_count
  FROM paginated_subjects ps;

  RETURN jsonb_build_object(
    'subjects', COALESCE(v_subjects, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- FIX SEARCH_STUDENTS_ADMIN
-- ========================

CREATE OR REPLACE FUNCTION search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
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
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_student_ids
    FROM (
      -- Search by student names (exact + fuzzy matching)
      SELECT id
      FROM students
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(school, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
      UNION
      -- Search by class names (exact + fuzzy matching)
      SELECT DISTINCT cs.student_id
      FROM classes_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.unenrolled_at IS NULL
        AND (
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

  WITH filtered_students AS (
    SELECT 
      s.id,
      s.first_name,
      s.last_name,
      s.status,
      s.curriculum,
      s.year_level,
      s.school
    FROM students s
    WHERE (v_student_ids IS NULL OR (array_length(v_student_ids, 1) > 0 AND s.id = ANY(v_student_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY 
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
                    'color', subj.color
                  )
                )
                ORDER BY c.day_of_week, c.start_time
              ),
              '[]'::jsonb
            )
            FROM classes_students cs2
            JOIN classes c ON c.id = cs2.class_id
            LEFT JOIN subjects subj ON subj.id = c.subject_id
            WHERE cs2.student_id = ps.id AND cs2.unenrolled_at IS NULL
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

-- ========================
-- FIX SEARCH_STAFF_ADMIN
-- ========================

CREATE OR REPLACE FUNCTION search_staff_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
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
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_staff_ids
    FROM (
      -- Search by staff names (exact + fuzzy matching)
      SELECT id
      FROM staff
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
      UNION
      -- Search by class names (exact + fuzzy matching)
      SELECT DISTINCT cs.staff_id
      FROM classes_staff cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.unassigned_at IS NULL
        AND (
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

  WITH filtered_staff AS (
    SELECT 
      st.id,
      st.first_name,
      st.last_name,
      st.role,
      st.status,
      st.email,
      st.phone_number
    FROM staff st
    WHERE (v_staff_ids IS NULL OR (array_length(v_staff_ids, 1) > 0 AND st.id = ANY(v_staff_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR st.status = ANY(p_statuses))
  ),
  paginated_staff AS (
    SELECT *
    FROM filtered_staff
    ORDER BY 
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'role' AND p_ascending THEN role END ASC,
      CASE WHEN p_order_by = 'role' AND NOT p_ascending THEN role END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
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
        'role', ps.role,
        'status', ps.status,
        'email', ps.email,
        'phone_number', ps.phone_number
      )
    ),
    (SELECT COUNT(*) FROM filtered_staff)
  INTO v_staff, v_total_count
  FROM paginated_staff ps;

  IF p_include_relationships AND v_staff IS NOT NULL THEN
    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_staff) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT ARRAY_AGG(DISTINCT cs.class_id)
    INTO v_class_ids
    FROM classes_staff cs
    JOIN staff_ids si ON si.id = cs.staff_id
    WHERE cs.unassigned_at IS NULL;

    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_staff) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      si.id::TEXT,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'day_of_week', c.day_of_week,
              'start_time', c.start_time::TEXT,
              'end_time', c.end_time::TEXT,
              'status', c.status,
              'room', c.room,
              'level', c.level,
              'subject_id', c.subject_id,
              'subject', jsonb_build_object(
                'id', subj.id,
                'curriculum', subj.curriculum,
                'year_level', subj.year_level,
                'name', subj.name,
                'discipline', subj.discipline,
                'level', subj.level,
                'color', subj.color
              )
            )
            ORDER BY c.day_of_week, c.start_time
          ),
          '[]'::jsonb
        )
        FROM classes_staff cs2
        JOIN classes c ON c.id = cs2.class_id
        LEFT JOIN subjects subj ON subj.id = c.subject_id
        WHERE cs2.staff_id = si.id AND cs2.unassigned_at IS NULL
      )
    )
    INTO v_staff_classes
    FROM staff_ids si;

    IF v_class_ids IS NOT NULL THEN
      SELECT jsonb_object_agg(
        class_id::TEXT,
        jsonb_build_object(
          'id', subj.id,
          'curriculum', subj.curriculum,
          'year_level', subj.year_level,
          'name', subj.name,
          'discipline', subj.discipline,
          'level', subj.level,
          'color', subj.color
        )
      )
      INTO v_class_subjects
      FROM unnest(v_class_ids) AS class_id
      JOIN classes c ON c.id = class_id
      LEFT JOIN subjects subj ON subj.id = c.subject_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'staff', COALESCE(v_staff, '[]'::jsonb),
    'staffClasses', COALESCE(v_staff_classes, '{}'::jsonb),
    'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- FIX SEARCH_CLASSES_ADMIN
-- ========================

CREATE OR REPLACE FUNCTION search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_include_relationships BOOLEAN DEFAULT TRUE,
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
      SELECT DISTINCT cs.class_id
      FROM classes_students cs
      JOIN students st ON st.id = cs.student_id
      WHERE cs.unenrolled_at IS NULL
        AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
        ))
      UNION
      SELECT DISTINCT cs.class_id
      FROM classes_staff cs
      JOIN staff st ON st.id = cs.staff_id
      WHERE cs.unassigned_at IS NULL
        AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
        ))
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
        'color', subj.color
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

-- ========================
-- FIX SEARCH_SESSIONS_ADMIN
-- ========================

CREATE OR REPLACE FUNCTION search_sessions_admin(
  -- Search & Filters
  p_search TEXT DEFAULT NULL,
  p_range_start TIMESTAMPTZ DEFAULT NULL,
  p_range_end TIMESTAMPTZ DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  
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

GRANT EXECUTE ON FUNCTION search_subjects_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_students_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_staff_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_sessions_admin TO authenticated;

COMMENT ON FUNCTION search_subjects_admin IS 'Admin search function for subjects with exact + fuzzy matching on shortname and longname. Fixed to return empty results when search matches nothing.';
COMMENT ON FUNCTION search_students_admin IS 'Admin search function for students with exact + fuzzy name matching and class name search. Fixed to return empty results when search matches nothing.';
COMMENT ON FUNCTION search_staff_admin IS 'Admin search function for staff with exact + fuzzy name matching and class name search. Fixed to return empty results when search matches nothing.';
COMMENT ON FUNCTION search_classes_admin IS 'Admin search function for classes with exact + fuzzy matching on class names. Fixed to return empty results when search matches nothing.';
COMMENT ON FUNCTION search_sessions_admin IS 'Admin search function for sessions with filtering, search, pagination, and relationship loading. Fixed to return empty results when search matches nothing.';
