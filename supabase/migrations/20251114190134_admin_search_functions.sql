-- Migration: Admin Search Functions
-- Description: Create PostgreSQL functions for efficient server-side search with pagination
-- for students, staff, and classes. Includes nested relationships support.

-- ========================
-- HELPER FUNCTIONS FOR CLASS NAME FORMATTING
-- ========================

-- Format subject short name (matches formatSubjectShortName)
-- Format: {curriculum} {year_level}{nickname} (no space between year_level and nickname)
-- Example: "SACE 12MATH" for "SACE 12 Mathematics"
CREATE OR REPLACE FUNCTION format_subject_short_name(
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      COALESCE(p_curriculum, ''),
      CASE 
        WHEN p_curriculum IS NOT NULL AND (p_year_level IS NOT NULL OR p_name IS NOT NULL) 
        THEN ' ' 
        ELSE '' 
      END,
      COALESCE(p_year_level::TEXT, ''),
      UPPER(LEFT(COALESCE(p_name, ''), 4))
    )
  );
$$;

-- Format class short name (matches formatClassShortName)
-- Format: {subject_short_name} {day} {start_time}
-- Example: "SACE 12MATH Mon 2:00 PM"
CREATE OR REPLACE FUNCTION format_class_short_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      format_subject_short_name(p_curriculum, p_year_level, p_name),
      CASE WHEN format_subject_short_name(p_curriculum, p_year_level, p_name) != '' AND p_day_of_week IS NOT NULL THEN ' ' ELSE '' END,
      CASE p_day_of_week
        WHEN 0 THEN 'Sun'
        WHEN 1 THEN 'Mon'
        WHEN 2 THEN 'Tue'
        WHEN 3 THEN 'Wed'
        WHEN 4 THEN 'Thu'
        WHEN 5 THEN 'Fri'
        WHEN 6 THEN 'Sat'
        ELSE ''
      END,
      CASE WHEN p_day_of_week IS NOT NULL AND p_start_time IS NOT NULL THEN ' ' ELSE '' END,
      CASE WHEN p_start_time IS NOT NULL THEN TO_CHAR(p_start_time, 'HH12:MI AM') ELSE '' END
    )
  );
$$;

-- Format class full name (matches formatClassName)
-- Format: {curriculum} {year_level} {subject_name} {day} {start_time} - {end_time}
-- Example: "SACE 12 Mathematics Mon 2:00 PM - 4:00 PM"
CREATE OR REPLACE FUNCTION format_class_full_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_end_time TIME,
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      COALESCE(p_curriculum, ''),
      CASE WHEN p_curriculum IS NOT NULL AND p_year_level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(p_year_level::TEXT, ''),
      CASE WHEN p_year_level IS NOT NULL AND p_name IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(p_name, ''),
      CASE WHEN p_name IS NOT NULL AND p_day_of_week IS NOT NULL THEN ' ' ELSE '' END,
      CASE p_day_of_week
        WHEN 0 THEN 'Sun'
        WHEN 1 THEN 'Mon'
        WHEN 2 THEN 'Tue'
        WHEN 3 THEN 'Wed'
        WHEN 4 THEN 'Thu'
        WHEN 5 THEN 'Fri'
        WHEN 6 THEN 'Sat'
        ELSE ''
      END,
      CASE WHEN p_day_of_week IS NOT NULL AND p_start_time IS NOT NULL THEN ' ' ELSE '' END,
      CASE WHEN p_start_time IS NOT NULL THEN TO_CHAR(p_start_time, 'HH12:MI AM') ELSE '' END,
      CASE WHEN p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN ' - ' ELSE '' END,
      CASE WHEN p_end_time IS NOT NULL THEN TO_CHAR(p_end_time, 'HH12:MI AM') ELSE '' END
    )
  );
$$;

-- ========================
-- STUDENT SEARCH FUNCTION
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
  v_student_ids UUID[];
  v_result JSONB;
  v_total_count BIGINT;
  v_students JSONB;
  v_classes JSONB;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- Build student ID list from search
  IF v_search_lower IS NOT NULL THEN
    -- Search by name, school, and class names
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_student_ids
    FROM (
      -- Search by concatenated name, individual names, and school
      SELECT id
      FROM students
      WHERE LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(school, '')) LIKE '%' || v_search_lower || '%'
      
      UNION
      
      -- Search by class names
      SELECT DISTINCT cs.student_id
      FROM classes_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE cs.unenrolled_at IS NULL
        AND (
          LOWER(format_class_short_name(
            c.day_of_week,
            c.start_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
          OR
          LOWER(format_class_full_name(
            c.day_of_week,
            c.start_time,
            c.end_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
        )
    ) search_results;
  END IF;

  -- Build main query
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
    WHERE (v_student_ids IS NULL OR s.id = ANY(v_student_ids))
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
      last_name ASC  -- Default fallback
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
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                'day_of_week', c.day_of_week,
                'start_time', c.start_time::TEXT,
                'level', c.level,
                'subject', jsonb_build_object(
                  'id', s.id,
                  'curriculum', s.curriculum,
                  'year_level', s.year_level,
                  'name', s.name,
                  'name_abbreviation', s.name_abbreviation,
                  'discipline', s.discipline,
                  'level', s.level,
                  'color', s.color
                )
              )
            )
            FROM classes_students cs2
            JOIN classes c ON c.id = cs2.class_id
            LEFT JOIN subjects s ON s.id = c.subject_id
            WHERE cs2.student_id = ps.id 
              AND cs2.unenrolled_at IS NULL
            ORDER BY c.day_of_week, c.start_time
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students ps;

  -- Build result
  RETURN jsonb_build_object(
    'students', COALESCE(v_students, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- STAFF SEARCH FUNCTION
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
  v_staff_ids UUID[];
  v_result JSONB;
  v_total_count BIGINT;
  v_staff JSONB;
  v_staff_classes JSONB;
  v_class_subjects JSONB;
  v_class_ids UUID[];
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('staff', '[]'::jsonb, 'staffClasses', '{}'::jsonb, 'classSubjects', '{}'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- Build staff ID list from search
  IF v_search_lower IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_staff_ids
    FROM (
      -- Search by concatenated name and individual names
      SELECT id
      FROM staff
      WHERE LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
      
      UNION
      
      -- Search by class names
      SELECT DISTINCT cs.staff_id
      FROM classes_staff cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE cs.status = 'ACTIVE'
        AND (
          LOWER(format_class_short_name(
            c.day_of_week,
            c.start_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
          OR
          LOWER(format_class_full_name(
            c.day_of_week,
            c.start_time,
            c.end_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
        )
    ) search_results;
  END IF;

  -- Build main query
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
    WHERE (v_staff_ids IS NULL OR st.id = ANY(v_staff_ids))
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
      last_name ASC  -- Default fallback
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

  -- Build relationships if requested
  IF p_include_relationships AND v_staff IS NOT NULL THEN
    -- Get staff IDs from result
    WITH staff_ids AS (
      SELECT id::UUID
      FROM jsonb_array_elements(v_staff) AS elem
      WHERE elem->>'id' IS NOT NULL
    )
    -- Get class IDs for returned staff
    SELECT ARRAY_AGG(DISTINCT cs.class_id)
    INTO v_class_ids
    FROM classes_staff cs
    JOIN staff_ids si ON si.id = cs.staff_id
    WHERE cs.status = 'ACTIVE';

    -- Build staffClasses record
    WITH staff_ids AS (
      SELECT id::UUID
      FROM jsonb_array_elements(v_staff) AS elem
      WHERE elem->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      si.id::TEXT,
      (
        SELECT jsonb_agg(
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
              'id', s.id,
              'curriculum', s.curriculum,
              'year_level', s.year_level,
              'name', s.name,
              'name_abbreviation', s.name_abbreviation,
              'discipline', s.discipline,
              'level', s.level,
              'color', s.color
            )
          )
        )
        FROM classes_staff cs2
        JOIN classes c ON c.id = cs2.class_id
        LEFT JOIN subjects s ON s.id = c.subject_id
        WHERE cs2.staff_id = si.id AND cs2.status = 'ACTIVE'
        ORDER BY c.day_of_week, c.start_time
      )
    )
    INTO v_staff_classes
    FROM staff_ids si;

    -- Build classSubjects record
    IF v_class_ids IS NOT NULL THEN
      SELECT jsonb_object_agg(
        c.id::TEXT,
        jsonb_build_object(
          'id', s.id,
          'curriculum', s.curriculum,
          'year_level', s.year_level,
          'name', s.name,
          'name_abbreviation', s.name_abbreviation,
          'discipline', s.discipline,
          'level', s.level,
          'color', s.color
        )
      )
      INTO v_class_subjects
      FROM classes c
      LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE c.id = ANY(v_class_ids);
    END IF;
  END IF;

  -- Build result
  RETURN jsonb_build_object(
    'staff', COALESCE(v_staff, '[]'::jsonb),
    'staffClasses', COALESCE(v_staff_classes, '{}'::jsonb),
    'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- CLASS SEARCH FUNCTION
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
  v_class_ids UUID[];
  v_result JSONB;
  v_total_count BIGINT;
  v_classes JSONB;
  v_class_subjects JSONB;
  v_class_students JSONB;
  v_class_staff JSONB;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'classes', '[]'::jsonb,
      'classSubjects', '{}'::jsonb,
      'classStudents', '{}'::jsonb,
      'classStaff', '{}'::jsonb,
      'total', 0
    );
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- Build class ID list from search
  IF v_search_lower IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_class_ids
    FROM (
      -- Search by class names
      SELECT DISTINCT c.id
      FROM classes c
      JOIN subjects s ON s.id = c.subject_id
      WHERE LOWER(format_class_short_name(
        c.day_of_week,
        c.start_time,
        s.curriculum,
        s.year_level,
        s.name
      )) LIKE '%' || v_search_lower || '%'
      OR LOWER(format_class_full_name(
        c.day_of_week,
        c.start_time,
        c.end_time,
        s.curriculum,
        s.year_level,
        s.name
      )) LIKE '%' || v_search_lower || '%'
      
      UNION
      
      -- Search by student names
      SELECT DISTINCT cs.class_id
      FROM classes_students cs
      JOIN students st ON st.id = cs.student_id
      WHERE cs.unenrolled_at IS NULL
        AND LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
      
      UNION
      
      -- Search by staff names
      SELECT DISTINCT cs.class_id
      FROM classes_staff cs
      JOIN staff st ON st.id = cs.staff_id
      WHERE cs.status = 'ACTIVE'
        AND LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
    ) search_results;
  END IF;

  -- Build main query
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
    WHERE (v_class_ids IS NULL OR c.id = ANY(v_class_ids))
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
      day_of_week ASC, start_time ASC  -- Default fallback
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

  -- Build relationships if requested
  IF p_include_relationships AND v_classes IS NOT NULL THEN
    -- Build classSubjects record
    WITH class_ids AS (
      SELECT id::UUID
      FROM jsonb_array_elements(v_classes) AS elem
      WHERE elem->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      c.id::TEXT,
      jsonb_build_object(
        'id', s.id,
        'curriculum', s.curriculum,
        'year_level', s.year_level,
        'name', s.name,
        'name_abbreviation', s.name_abbreviation,
        'discipline', s.discipline,
        'level', s.level,
        'color', s.color
      )
    )
    INTO v_class_subjects
    FROM class_ids ci
    JOIN classes c ON c.id = ci.id
    LEFT JOIN subjects s ON s.id = c.subject_id;

    -- Build classStudents record
    WITH class_ids AS (
      SELECT id::UUID
      FROM jsonb_array_elements(v_classes) AS elem
      WHERE elem->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      ci.id::TEXT,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'status', st.status,
            'curriculum', st.curriculum,
            'year_level', st.year_level,
            'school', st.school
          )
        )
        FROM classes_students cs
        JOIN students st ON st.id = cs.student_id
        WHERE cs.class_id = ci.id AND cs.unenrolled_at IS NULL
        ORDER BY st.last_name, st.first_name
      )
    )
    INTO v_class_students
    FROM class_ids ci;

    -- Build classStaff record
    WITH class_ids AS (
      SELECT id::UUID
      FROM jsonb_array_elements(v_classes) AS elem
      WHERE elem->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(
      ci.id::TEXT,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'role', st.role,
            'status', st.status,
            'email', st.email,
            'phone_number', st.phone_number
          )
        )
        FROM classes_staff cs
        JOIN staff st ON st.id = cs.staff_id
        WHERE cs.class_id = ci.id AND cs.status = 'ACTIVE'
        ORDER BY st.last_name, st.first_name
      )
    )
    INTO v_class_staff
    FROM class_ids ci;
  END IF;

  -- Build result
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
-- HELPER FUNCTIONS FOR INDEXES
-- ========================

-- Helper function for student full name (IMMUTABLE for index use)
CREATE OR REPLACE FUNCTION student_full_name_lower(
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(CONCAT(COALESCE(p_first_name, ''), ' ', COALESCE(p_last_name, '')));
$$;

-- Helper function for staff full name (IMMUTABLE for index use)
CREATE OR REPLACE FUNCTION staff_full_name_lower(
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(CONCAT(COALESCE(p_first_name, ''), ' ', COALESCE(p_last_name, '')));
$$;

-- ========================
-- PERFORMANCE INDEXES
-- ========================

-- Index for full name searches on students
CREATE INDEX IF NOT EXISTS idx_students_full_name 
ON students (student_full_name_lower(first_name, last_name));

-- Index for full name searches on staff
CREATE INDEX IF NOT EXISTS idx_staff_full_name 
ON staff (staff_full_name_lower(first_name, last_name));

-- Index for active student enrollments
CREATE INDEX IF NOT EXISTS idx_classes_students_active 
ON classes_students (student_id) 
WHERE unenrolled_at IS NULL;

-- Index for active staff assignments
CREATE INDEX IF NOT EXISTS idx_classes_staff_active 
ON classes_staff (class_id) 
WHERE status = 'ACTIVE';

-- ========================
-- GRANT PERMISSIONS
-- ========================

GRANT EXECUTE ON FUNCTION format_subject_short_name TO authenticated;
GRANT EXECUTE ON FUNCTION format_class_short_name TO authenticated;
GRANT EXECUTE ON FUNCTION format_class_full_name TO authenticated;
GRANT EXECUTE ON FUNCTION student_full_name_lower TO authenticated;
GRANT EXECUTE ON FUNCTION staff_full_name_lower TO authenticated;
GRANT EXECUTE ON FUNCTION search_students_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_staff_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;

