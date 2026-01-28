-- Migration: Fix search_students_admin to include subject object in classes array
-- Description: The classes array in search_students_admin was only including subject_id,
-- but the frontend expects the full subject object (with short_name, etc.) to display
-- class names correctly. This matches the pattern used in search_staff_admin.

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
      s.updated_at,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          CASE 
            -- Exact match in full name (highest priority)
            WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) = v_search_lower THEN 1000
            -- Starts with search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in first_name
            WHEN LOWER(COALESCE(s.first_name, '')) = v_search_lower THEN 700
            -- Starts with search term in first_name
            WHEN LOWER(COALESCE(s.first_name, '')) LIKE v_search_lower || '%' THEN 600
            -- Contains search term in first_name
            WHEN LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%' THEN 500
            -- Exact match in last_name
            WHEN LOWER(COALESCE(s.last_name, '')) = v_search_lower THEN 400
            -- Starts with search term in last_name
            WHEN LOWER(COALESCE(s.last_name, '')) LIKE v_search_lower || '%' THEN 300
            -- Contains search term in last_name
            WHEN LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Contains search term in school
            WHEN LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%' THEN 100
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, '')) ILIKE v_search_like
              OR COALESCE(s.first_name, '') ILIKE v_search_like
              OR COALESCE(s.last_name, '') ILIKE v_search_like
            ) THEN 50
            ELSE 0
          END
      END AS relevance_score
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
      -- Sort by relevance score (highest first), then user-specified ordering
      relevance_score DESC,
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
            FROM classes_students cs
            JOIN classes c ON c.id = cs.class_id
            LEFT JOIN subjects subj ON subj.id = c.subject_id
            WHERE cs.student_id = ps.id
              AND cs.unenrolled_at IS NULL
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

GRANT EXECUTE ON FUNCTION search_students_admin TO authenticated;

COMMENT ON FUNCTION search_students_admin IS 'Admin search function for students with exact + fuzzy matching on names and school. Results are ranked by relevance: exact matches in name fields are prioritized over school/class matches. Supports filtering by statuses and subject_ids. Returns students with class relationships including full subject objects with short_name and long_name fields.';
