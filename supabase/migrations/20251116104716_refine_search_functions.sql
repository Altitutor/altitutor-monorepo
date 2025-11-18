-- Migration: Refine search functions with fuzzy matching and richer relationships

DO $$
DECLARE
  v_dummy TEXT;
BEGIN
  v_dummy := 'noop';
END $$;

-- Helper to build fuzzy LIKE pattern (e.g. IB BIO -> %I%B%B%I%O%)
CREATE OR REPLACE FUNCTION build_fuzzy_like(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  v_normalized := regexp_replace(p_text, '[^a-z0-9]', '', 'ig');
  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;
  RETURN '%' || COALESCE((
    SELECT string_agg(ch, '%')
    FROM regexp_split_to_table(v_normalized, '') AS ch
    WHERE ch <> ''
  ), '') || '%';
END;
$$;

-- ========================
-- search_students_admin
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
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_student_ids
    FROM (
      SELECT id
      FROM students
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(school, '')) LIKE '%' || v_search_lower || '%'
      UNION
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
-- search_staff_admin
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
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_staff_ids
    FROM (
      SELECT id
      FROM staff
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT cs.staff_id
      FROM classes_staff cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.status = 'ACTIVE'
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
    WHERE cs.status = 'ACTIVE';

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
        WHERE cs2.staff_id = si.id AND cs2.status = 'ACTIVE'
      )
    )
    INTO v_staff_classes
    FROM staff_ids si;

    IF v_class_ids IS NOT NULL THEN
      SELECT jsonb_object_agg(
        c.id::TEXT,
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
      FROM classes c
      LEFT JOIN subjects subj ON subj.id = c.subject_id
      WHERE c.id = ANY(v_class_ids);
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
-- search_classes_admin
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
    RETURN jsonb_build_object(
      'classes', '[]'::jsonb,
      'classSubjects', '{}'::jsonb,
      'classStudents', '{}'::jsonb,
      'classStaff', '{}'::jsonb,
      'total', 0
    );
  END IF;

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_class_ids
    FROM (
      SELECT DISTINCT c.id
      FROM classes c
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE LOWER(format_class_short_name(
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
      UNION
      SELECT DISTINCT cs.class_id
      FROM classes_students cs
      JOIN students st ON st.id = cs.student_id
      WHERE cs.unenrolled_at IS NULL
        AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT cs.class_id
      FROM classes_staff cs
      JOIN staff st ON st.id = cs.staff_id
      WHERE cs.status = 'ACTIVE'
        AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
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
        WHERE cs.class_id = ci.id AND cs.status = 'ACTIVE'
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
-- search_all_admin
-- ======================== (snipped? we need rest)

CREATE OR REPLACE FUNCTION search_all_admin(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_statuses_students TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_statuses_staff TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_statuses_classes TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_weight_primary INTEGER DEFAULT 100,
  p_weight_secondary INTEGER DEFAULT 50
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
  v_results JSONB;
  v_total_count BIGINT;
  v_has_more BOOLEAN;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NULL THEN
    RETURN jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  WITH student_results AS (
    SELECT 
      'student'::TEXT AS type,
      s.id,
      CASE 
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%'
        THEN p_weight_primary
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%'
        THEN 'primary'::TEXT
        ELSE 'secondary'::TEXT
      END AS match_type,
      jsonb_build_object(
        'id', s.id,
        'first_name', s.first_name,
        'last_name', s.last_name,
        'status', s.status,
        'curriculum', s.curriculum,
        'year_level', s.year_level,
        'school', s.school,
        'classes', (
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
          FROM classes_students cs
          JOIN classes c ON c.id = cs.class_id
          LEFT JOIN subjects subj ON subj.id = c.subject_id
          WHERE cs.student_id = s.id AND cs.unenrolled_at IS NULL
        )
      ) AS data
    FROM students s
    WHERE (p_statuses_students IS NULL OR array_length(p_statuses_students, 1) IS NULL OR s.status = ANY(p_statuses_students))
      AND (
        LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%'
        OR EXISTS (
          SELECT 1
          FROM classes_students cs
          JOIN classes c ON c.id = cs.class_id
          JOIN subjects subj ON subj.id = c.subject_id
          WHERE cs.student_id = s.id
            AND cs.unenrolled_at IS NULL
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
        )
      )
  ),
  staff_results AS (
    SELECT 
      'staff'::TEXT AS type,
      st.id,
      CASE 
        WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
        THEN p_weight_primary
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
        THEN 'primary'::TEXT
        ELSE 'secondary'::TEXT
      END AS match_type,
      jsonb_build_object(
        'id', st.id,
        'first_name', st.first_name,
        'last_name', st.last_name,
        'role', st.role,
        'status', st.status,
        'email', st.email,
        'phone_number', st.phone_number,
        'classes', (
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
          FROM classes_staff cs
          JOIN classes c ON c.id = cs.class_id
          LEFT JOIN subjects subj ON subj.id = c.subject_id
          WHERE cs.staff_id = st.id AND cs.status = 'ACTIVE'
        )
      ) AS data
    FROM staff st
    WHERE (p_statuses_staff IS NULL OR array_length(p_statuses_staff, 1) IS NULL OR st.status = ANY(p_statuses_staff))
      AND (
        LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
        OR EXISTS (
          SELECT 1
          FROM classes_staff cs
          JOIN classes c ON c.id = cs.class_id
          JOIN subjects subj ON subj.id = c.subject_id
          WHERE cs.staff_id = st.id
            AND cs.status = 'ACTIVE'
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
        )
      )
  ),
  class_results AS (
    SELECT 
      'class'::TEXT AS type,
      c.id,
      CASE 
        WHEN LOWER(format_class_short_name(
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
        THEN p_weight_primary
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(format_class_short_name(
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
        THEN 'primary'::TEXT
        ELSE 'secondary'::TEXT
      END AS match_type,
      jsonb_build_object(
        'id', c.id,
        'day_of_week', c.day_of_week,
        'start_time', c.start_time::TEXT,
        'end_time', c.end_time::TEXT,
        'status', c.status,
        'room', c.room,
        'subject_id', c.subject_id,
        'level', c.level,
        'subject', jsonb_build_object(
          'id', subj.id,
          'curriculum', subj.curriculum,
          'year_level', subj.year_level,
          'name', subj.name,
          'discipline', subj.discipline,
          'level', subj.level,
          'color', subj.color
        ),
        'staff', (
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
          WHERE cs.class_id = c.id AND cs.status = 'ACTIVE'
        ),
        'students', (
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
          WHERE cs.class_id = c.id AND cs.unenrolled_at IS NULL
        )
      ) AS data
    FROM classes c
    JOIN subjects subj ON subj.id = c.subject_id
    WHERE (p_statuses_classes IS NULL OR array_length(p_statuses_classes, 1) IS NULL OR c.status = ANY(p_statuses_classes))
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
        OR EXISTS (
          SELECT 1
          FROM classes_students cs
          JOIN students st ON st.id = cs.student_id
          WHERE cs.class_id = c.id
            AND cs.unenrolled_at IS NULL
            AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM classes_staff cs
          JOIN staff st ON st.id = cs.staff_id
          WHERE cs.class_id = c.id
            AND cs.status = 'ACTIVE'
            AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        )
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
  ),
  all_results AS (
    SELECT * FROM student_results
    UNION ALL
    SELECT * FROM staff_results
    UNION ALL
    SELECT * FROM class_results
  ),
  sorted_results AS (
    SELECT 
      type,
      id,
      score,
      match_type,
      data
    FROM all_results
    ORDER BY 
      score DESC,
      CASE type
        WHEN 'student' THEN (data->>'last_name') || ' ' || (data->>'first_name')
        WHEN 'staff' THEN (data->>'last_name') || ' ' || (data->>'first_name')
        WHEN 'class' THEN (data->'subject'->>'curriculum') || ' ' || (data->'subject'->>'year_level') || ' ' || (data->'subject'->>'name')
      END ASC
  ),
  paginated_results AS (
    SELECT *
    FROM sorted_results
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'type', type,
        'id', id,
        'score', score,
        'match_type', match_type,
        'data', data
      )
    ),
    (SELECT COUNT(*) FROM sorted_results),
    (SELECT COUNT(*) FROM sorted_results) > (p_offset + p_limit)
  INTO v_results, v_total_count, v_has_more
  FROM paginated_results;

  RETURN jsonb_build_object(
    'results', COALESCE(v_results, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0),
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION search_students_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_staff_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;
GRANT EXECUTE ON FUNCTION search_all_admin TO authenticated;
