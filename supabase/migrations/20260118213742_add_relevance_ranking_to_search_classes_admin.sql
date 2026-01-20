-- Migration: Add relevance-based ranking to search_classes_admin
-- Description: Prioritize exact matches in class names over student/staff name matches
-- Ranking priority:
--   1. Exact match in class shortname
--   2. Starts with search term in class shortname
--   3. Contains search term in class shortname
--   4. Exact match in class fullname
--   5. Starts with search term in class fullname
--   6. Contains search term in class fullname
--   7. Exact match in subject shortname + day + time combination
--   8. Contains search term in subject shortname + day + time combination
--   9. Exact match in subject longname + day + time combination
--   10. Contains search term in subject longname + day + time combination
--   11. Matches in student/staff names (lower priority)
--   12. User-specified ordering fallback

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
      c.level,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          CASE 
            -- Exact match in class shortname (highest priority)
            WHEN LOWER(format_class_short_name(
              c.day_of_week,
              c.start_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) = v_search_lower THEN 1000
            -- Starts with search term in class shortname
            WHEN LOWER(format_class_short_name(
              c.day_of_week,
              c.start_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in class shortname
            WHEN LOWER(format_class_short_name(
              c.day_of_week,
              c.start_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in class fullname
            WHEN LOWER(format_class_full_name(
              c.day_of_week,
              c.start_time::time,
              c.end_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) = v_search_lower THEN 750
            -- Starts with search term in class fullname
            WHEN LOWER(format_class_full_name(
              c.day_of_week,
              c.start_time::time,
              c.end_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) LIKE v_search_lower || '%' THEN 700
            -- Contains search term in class fullname
            WHEN LOWER(format_class_full_name(
              c.day_of_week,
              c.start_time::time,
              c.end_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            )) LIKE '%' || v_search_lower || '%' THEN 600
            -- Exact match in subject shortname + day + time combination
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name),
                format_day_short_name(c.day_of_week),
                TO_CHAR(c.start_time::time, 'HH12:MI AM')
              )
            ) = v_search_lower THEN 500
            -- Contains search term in subject shortname + day + time combination
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name),
                format_day_short_name(c.day_of_week),
                TO_CHAR(c.start_time::time, 'HH12:MI AM')
              )
            ) LIKE '%' || v_search_lower || '%' THEN 400
            -- Exact match in subject longname + day + time combination
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level),
                format_day_short_name(c.day_of_week),
                TO_CHAR(c.start_time::time, 'HH12:MI AM')
              )
            ) = v_search_lower THEN 350
            -- Contains search term in subject longname + day + time combination
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_long_name(subj.curriculum::text, subj.year_level, subj.name, subj.level),
                format_day_short_name(c.day_of_week),
                TO_CHAR(c.start_time::time, 'HH12:MI AM')
              )
            ) LIKE '%' || v_search_lower || '%' THEN 300
            -- Individual component matches (lower priority)
            WHEN LOWER(format_subject_short_name(subj.curriculum::text, subj.year_level, subj.name)) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(format_day_short_name(c.day_of_week)) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(TO_CHAR(c.start_time::time, 'HH12:MI AM')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Student/staff name matches (lowest priority for class name search)
            WHEN EXISTS (
              SELECT 1 FROM classes_students cs
              JOIN students st ON st.id = cs.student_id
              WHERE cs.class_id = c.id
                AND cs.unenrolled_at IS NULL
                AND NOT p_exclude_student_search
                AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
            ) THEN 100
            WHEN EXISTS (
              SELECT 1 FROM classes_staff cs
              JOIN staff st ON st.id = cs.staff_id
              WHERE cs.class_id = c.id
                AND cs.unassigned_at IS NULL
                AND NOT p_exclude_staff_search
                AND LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
            ) THEN 100
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              format_class_short_name(
                c.day_of_week,
                c.start_time::time,
                subj.curriculum::text,
                subj.year_level,
                subj.name
              ) ILIKE v_search_like
            ) THEN 50
            ELSE 0
          END
      END AS relevance_score
    FROM classes c
    JOIN subjects subj ON subj.id = c.subject_id
    WHERE (v_class_ids IS NULL OR (array_length(v_class_ids, 1) > 0 AND c.id = ANY(v_class_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR c.status = ANY(p_statuses))
      -- Filter by subject_ids: class must have one of the specified subject(s)
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR c.subject_id = ANY(p_subject_ids))
  ),
  paginated_classes AS (
    SELECT *
    FROM filtered_classes
    ORDER BY 
      -- Sort by relevance score (highest first), then user-specified ordering
      relevance_score DESC,
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
        FROM classes_students cs
        JOIN students s ON s.id = cs.student_id
        WHERE cs.class_id = ci.id
          AND cs.unenrolled_at IS NULL
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
              'status', st.status
            )
            ORDER BY st.last_name, st.first_name
          ),
          '[]'::jsonb
        )
        FROM classes_staff cs
        JOIN staff st ON st.id = cs.staff_id
        WHERE cs.class_id = ci.id
          AND cs.unassigned_at IS NULL
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

GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;

COMMENT ON FUNCTION search_classes_admin IS 'Admin search function for classes with exact + fuzzy matching on class names and partial component matching (subject shortname/longname, day short/full, time) in any order. Results are ranked by relevance: exact matches in class names are prioritized over student/staff name matches. Supports filtering by subject_ids. Returns subjects with short_name and long_name fields.';
