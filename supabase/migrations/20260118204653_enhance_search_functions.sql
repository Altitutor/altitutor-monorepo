-- Migration: Enhance search functions for improved search capabilities
-- Description:
--   1. Modify search_students_admin: Add optional parameter to exclude class name search
--   2. Modify search_staff_admin: Add optional parameter to exclude class name search
--   3. Keep search_parents_admin as is (already searches by name only)
--   4. Enhance search_classes_admin: Add support for partial combinations (subject, day, time) in any order
--   5. Keep search_topics_admin as is (already supports combinations)
--   6. Keep search_subjects_admin as is
--   7. Create new search_files_admin: Search files by subject, code, type, topic name, file name

-- ========================
-- HELPER FUNCTION: Format day name (full)
-- ========================
CREATE OR REPLACE FUNCTION format_day_full_name(p_day_of_week INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_day_of_week
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    ELSE ''
  END;
$$;

-- ========================
-- HELPER FUNCTION: Format day name (short)
-- ========================
CREATE OR REPLACE FUNCTION format_day_short_name(p_day_of_week INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_day_of_week
    WHEN 0 THEN 'Sun'
    WHEN 1 THEN 'Mon'
    WHEN 2 THEN 'Tue'
    WHEN 3 THEN 'Wed'
    WHEN 4 THEN 'Thu'
    WHEN 5 THEN 'Fri'
    WHEN 6 THEN 'Sat'
    ELSE ''
  END;
$$;

-- ========================
-- UPDATE SEARCH_STUDENTS_ADMIN FUNCTION
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
      -- Only include class name search if p_exclude_class_search is FALSE
      UNION ALL
      SELECT DISTINCT cs.student_id
      FROM classes_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.unenrolled_at IS NULL
        AND NOT p_exclude_class_search
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
      s.school,
      s.phone,
      s.email,
      s.created_at,
      s.updated_at
    FROM students s
    WHERE (v_student_ids IS NULL OR (array_length(v_student_ids, 1) > 0 AND s.id = ANY(v_student_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      -- Filter by subject_ids: student must have direct subject enrollment (students_subjects) 
      -- AND/OR be enrolled in at least one class with the specified subject(s)
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

COMMENT ON FUNCTION search_students_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for students with exact + fuzzy name matching. Optional class name search (can be excluded via p_exclude_class_search). Returns phone and email fields. Supports filtering by subject_ids via students_subjects AND/OR classes_students.classes.subject_id. Returns subjects with short_name and long_name fields.';

-- ========================
-- UPDATE SEARCH_STAFF_ADMIN FUNCTION
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
      -- Only include class name search if p_exclude_class_search is FALSE
      UNION ALL
      SELECT DISTINCT cs.staff_id
      FROM classes_staff cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.unassigned_at IS NULL
        AND NOT p_exclude_class_search
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
      -- Filter by subject_ids: staff must have direct subject assignment (staff_subjects) 
      -- AND/OR be assigned to at least one class with the specified subject(s)
      AND (
        p_subject_ids IS NULL 
        OR array_length(p_subject_ids, 1) IS NULL 
        OR EXISTS (
          SELECT 1
          FROM staff_subjects ss
          WHERE ss.staff_id = st.id
            AND ss.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM classes_staff cs
          JOIN classes c ON c.id = cs.class_id
          WHERE cs.staff_id = st.id
            AND cs.unassigned_at IS NULL
            AND c.subject_id = ANY(p_subject_ids)
        )
      )
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
                'color', subj.color,
                'short_name', subj.short_name,
                'long_name', subj.long_name
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
          'color', subj.color,
          'short_name', subj.short_name,
          'long_name', subj.long_name
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

COMMENT ON FUNCTION search_staff_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for staff with exact + fuzzy name matching. Optional class name search (can be excluded via p_exclude_class_search). Fixed to return empty results when search matches nothing. Supports filtering by subject_ids via staff_subjects AND/OR classes_staff.classes.subject_id. Returns subjects with short_name and long_name fields.';

-- ========================
-- UPDATE SEARCH_CLASSES_ADMIN FUNCTION
-- ========================
-- Enhance to support partial combinations: subject shortname/longname, day (short/full), time
-- in any order (similar to topics search pattern)

CREATE OR REPLACE FUNCTION search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
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
      
      UNION
      
      -- Search by student names in classes
      SELECT DISTINCT cs.class_id
      FROM classes_students cs
      JOIN students st ON st.id = cs.student_id
      WHERE cs.unenrolled_at IS NULL
        AND (
          LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
          ))
        )
      
      UNION
      
      -- Search by staff names in classes
      SELECT DISTINCT cs.class_id
      FROM classes_staff cs
      JOIN staff st ON st.id = cs.staff_id
      WHERE cs.unassigned_at IS NULL
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

COMMENT ON FUNCTION search_classes_admin(TEXT, TEXT[], UUID[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for classes with exact + fuzzy matching on class names and partial component matching (subject shortname/longname, day short/full, time) in any order. Fixed to return empty results when search matches nothing. Supports filtering by subject_ids. Returns subjects with short_name and long_name fields.';

-- ========================
-- CREATE SEARCH_FILES_ADMIN FUNCTION
-- ========================
-- Search files by: subject shortname/longname, file code, file type, topic name, file name
-- Supports exact + fuzzy matching, in any order/combination

CREATE OR REPLACE FUNCTION search_files_admin(
  -- Search
  p_search TEXT DEFAULT NULL,
  
  -- Filters
  p_subject_ids UUID[] DEFAULT NULL,
  p_topic_ids UUID[] DEFAULT NULL,
  p_file_types TEXT[] DEFAULT NULL,  -- resource_type enum values
  
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
  v_file_ids UUID[];
  v_files JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('files', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build file ID list from search (if search provided)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT file_id), ARRAY[]::UUID[])
    INTO v_file_ids
    FROM (
      -- Search by subject shortname + file code + file type + topic name + file name (concatenated)
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          LOWER(
            CONCAT_WS(' ',
              format_subject_short_name(s.curriculum::text, s.year_level, s.name),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            )
          ) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ',
              format_subject_short_name(s.curriculum::text, s.year_level, s.name),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            ) ILIKE v_search_like
          ))
        )
      
      UNION
      
      -- Search by subject longname + file code + file type + topic name + file name (concatenated)
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          LOWER(
            CONCAT_WS(' ',
              format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            )
          ) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ',
              format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            ) ILIKE v_search_like
          ))
        )
      
      UNION
      
      -- Search by individual fields for better coverage and partial matching
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          -- Subject shortname/longname
          LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%'
          OR LOWER(format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level)) LIKE '%' || v_search_lower || '%'
          -- File code
          OR LOWER(COALESCE(tf.code, '')) LIKE '%' || v_search_lower || '%'
          -- File type
          OR LOWER(tf.type::text) LIKE '%' || v_search_lower || '%'
          -- Topic name
          OR LOWER(COALESCE(t.name, '')) LIKE '%' || v_search_lower || '%'
          -- File name
          OR LOWER(COALESCE(f.filename, '')) LIKE '%' || v_search_lower || '%'
          -- Fuzzy matching
          OR (v_search_like IS NOT NULL AND (
            format_subject_short_name(s.curriculum::text, s.year_level, s.name) ILIKE v_search_like
            OR format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level) ILIKE v_search_like
            OR COALESCE(tf.code, '') ILIKE v_search_like
            OR tf.type::text ILIKE v_search_like
            OR COALESCE(t.name, '') ILIKE v_search_like
            OR COALESCE(f.filename, '') ILIKE v_search_like
          ))
        )
    ) search_results;
  END IF;

  -- Build main query with filters
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
      -- File details
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.metadata AS file_metadata,
      -- Topic details
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      -- Subject details
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
      -- Search filter: if search was provided, v_file_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_file_ids IS NULL (show all)
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.file_id = ANY(v_file_ids)))
      -- Subject filter
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      -- Topic filter
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      -- File type filter
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  paginated_files AS (
    SELECT *
    FROM filtered_files
    ORDER BY 
      -- Sort by subject name, then topic name, then file index
      subject_name ASC,
      topic_name ASC,
      index ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
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
          'id', pf.file_id,
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
    ),
    COUNT(*)
  INTO v_files, v_total_count
  FROM paginated_files pf;

  RETURN jsonb_build_object(
    'files', COALESCE(v_files, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION search_files_admin TO authenticated;

COMMENT ON FUNCTION search_files_admin IS 'Admin search function for files (topics_files) with exact + fuzzy matching on subject shortname/longname, file code, file type, topic name, and file name. Supports filtering by subject_ids, topic_ids, and file_types. Returns files with topic and subject relationships.';
