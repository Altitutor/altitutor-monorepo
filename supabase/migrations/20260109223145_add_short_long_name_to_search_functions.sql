-- Migration: Add short_name and long_name to search functions
-- Description:
--   - Update search_classes_admin to include short_name and long_name in classSubjects
--   - Update search_staff_admin to include short_name and long_name in staffClasses[].subject and classSubjects
--   - Update search_students_admin to include short_name and long_name in classes[].subject
--   - Update search_topics_admin to include short_name and long_name in subject
--   - This ensures subject objects returned from these search functions have these fields populated
--   - Fixes issue where class cards show blank class names in assign staff modal

-- ========================
-- UPDATE SEARCH_CLASSES_ADMIN FUNCTION
-- ========================

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

COMMENT ON FUNCTION search_classes_admin(TEXT, TEXT[], UUID[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for classes with exact + fuzzy matching on class names. Fixed to return empty results when search matches nothing. Supports filtering by subject_ids. Returns subjects with short_name and long_name fields.';

-- ========================
-- UPDATE SEARCH_STAFF_ADMIN FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION search_staff_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
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

COMMENT ON FUNCTION search_staff_admin(TEXT, TEXT[], UUID[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for staff with exact + fuzzy name matching and class name search. Fixed to return empty results when search matches nothing. Supports filtering by subject_ids via staff_subjects AND/OR classes_staff.classes.subject_id. Returns subjects with short_name and long_name fields.';

-- ========================
-- UPDATE SEARCH_STUDENTS_ADMIN FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
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

COMMENT ON FUNCTION search_students_admin(TEXT, TEXT[], UUID[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for students with exact + fuzzy name matching and class name search. Returns phone and email fields. Supports filtering by subject_ids via students_subjects AND/OR classes_students.classes.subject_id. Returns subjects with short_name and long_name fields.';

-- ========================
-- UPDATE SEARCH_TOPICS_ADMIN FUNCTION
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
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
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
          'year_level', pt.subject_year_level,
          'discipline', pt.subject_discipline,
          'level', pt.subject_level,
          'color', pt.subject_color,
          'short_name', pt.subject_short_name,
          'long_name', pt.subject_long_name
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

COMMENT ON FUNCTION search_topics_admin IS 'Admin search function for topics with exact + fuzzy matching on shortname and longname, and filtering by subject_ids. Returns subjects with short_name and long_name fields.';

