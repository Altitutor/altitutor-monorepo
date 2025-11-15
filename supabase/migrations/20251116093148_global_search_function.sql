-- Migration: Global Unified Search Function
-- Description: Create PostgreSQL function for unified search across students, staff, and classes
-- with weighted relevance scoring and pagination support.

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
  v_all_results JSONB;
  v_total_count BIGINT;
  v_has_more BOOLEAN;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  -- If no search term, return empty results
  IF v_search_lower IS NULL THEN
    RETURN jsonb_build_object('results', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  -- Build unified search results with weighted scoring
  WITH student_results AS (
    SELECT 
      'student'::TEXT AS type,
      s.id,
      CASE 
        -- Primary match: name or school
        WHEN LOWER(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%'
        THEN p_weight_primary
        -- Secondary match: class name
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
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
        'school', s.school
      ) AS data
    FROM students s
    WHERE (p_statuses_students IS NULL OR array_length(p_statuses_students, 1) IS NULL OR s.status = ANY(p_statuses_students))
      AND (
        -- Primary match conditions
        LOWER(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.school, '')) LIKE '%' || v_search_lower || '%'
        -- Secondary match: class name
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
                c.start_time,
                subj.curriculum,
                subj.year_level,
                subj.name
              )) LIKE '%' || v_search_lower || '%'
              OR
              LOWER(format_class_full_name(
                c.day_of_week,
                c.start_time,
                c.end_time,
                subj.curriculum,
                subj.year_level,
                subj.name
              )) LIKE '%' || v_search_lower || '%'
            )
        )
      )
  ),
  staff_results AS (
    SELECT 
      'staff'::TEXT AS type,
      st.id,
      CASE 
        -- Primary match: name
        WHEN LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
          OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
        THEN p_weight_primary
        -- Secondary match: class name
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
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
        'phone_number', st.phone_number
      ) AS data
    FROM staff st
    WHERE (p_statuses_staff IS NULL OR array_length(p_statuses_staff, 1) IS NULL OR st.status = ANY(p_statuses_staff))
      AND (
        -- Primary match conditions
        LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%'
        -- Secondary match: class name
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
                c.start_time,
                subj.curriculum,
                subj.year_level,
                subj.name
              )) LIKE '%' || v_search_lower || '%'
              OR
              LOWER(format_class_full_name(
                c.day_of_week,
                c.start_time,
                c.end_time,
                subj.curriculum,
                subj.year_level,
                subj.name
              )) LIKE '%' || v_search_lower || '%'
            )
        )
      )
  ),
  class_results AS (
    SELECT 
      'class'::TEXT AS type,
      c.id,
      CASE 
        -- Primary match: class name
        WHEN LOWER(format_class_short_name(
          c.day_of_week,
          c.start_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_class_full_name(
          c.day_of_week,
          c.start_time,
          c.end_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        THEN p_weight_primary
        -- Secondary match: student or staff name
        ELSE p_weight_secondary
      END AS score,
      CASE 
        WHEN LOWER(format_class_short_name(
          c.day_of_week,
          c.start_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_class_full_name(
          c.day_of_week,
          c.start_time,
          c.end_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
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
          'name_abbreviation', subj.name_abbreviation,
          'discipline', subj.discipline,
          'level', subj.level,
          'color', subj.color
        )
      ) AS data
    FROM classes c
    JOIN subjects subj ON subj.id = c.subject_id
    WHERE (p_statuses_classes IS NULL OR array_length(p_statuses_classes, 1) IS NULL OR c.status = ANY(p_statuses_classes))
      AND (
        -- Primary match: class name
        LOWER(format_class_short_name(
          c.day_of_week,
          c.start_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_class_full_name(
          c.day_of_week,
          c.start_time,
          c.end_time,
          subj.curriculum,
          subj.year_level,
          subj.name
        )) LIKE '%' || v_search_lower || '%'
        -- Secondary match: student or staff name
        OR EXISTS (
          SELECT 1
          FROM classes_students cs
          JOIN students s ON s.id = cs.student_id
          WHERE cs.class_id = c.id
            AND cs.unenrolled_at IS NULL
            AND LOWER(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM classes_staff cs
          JOIN staff st ON st.id = cs.staff_id
          WHERE cs.class_id = c.id
            AND cs.status = 'ACTIVE'
            AND LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
        )
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
  INTO v_all_results, v_total_count, v_has_more
  FROM paginated_results;

  -- Build result
  RETURN jsonb_build_object(
    'results', COALESCE(v_all_results, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0),
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_all_admin TO authenticated;

