-- Migration: Add relevance-based ranking to search_staff_admin
-- Description: Prioritize exact matches and matches in name fields over class matches
-- Ranking priority:
--   1. Exact match in full name (first_name + last_name)
--   2. Starts with search term in full name
--   3. Contains search term in full name
--   4. Exact match in first_name
--   5. Starts with search term in first_name
--   6. Contains search term in first_name
--   7. Exact match in last_name
--   8. Starts with search term in last_name
--   9. Contains search term in last_name
--   10. Fuzzy match
--   11. User-specified ordering fallback

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
      st.phone_number,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          CASE 
            -- Exact match in full name (highest priority)
            WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) = v_search_lower THEN 1000
            -- Starts with search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in first_name
            WHEN LOWER(COALESCE(st.first_name, '')) = v_search_lower THEN 700
            -- Starts with search term in first_name
            WHEN LOWER(COALESCE(st.first_name, '')) LIKE v_search_lower || '%' THEN 600
            -- Contains search term in first_name
            WHEN LOWER(COALESCE(st.first_name, '')) LIKE '%' || v_search_lower || '%' THEN 500
            -- Exact match in last_name
            WHEN LOWER(COALESCE(st.last_name, '')) = v_search_lower THEN 400
            -- Starts with search term in last_name
            WHEN LOWER(COALESCE(st.last_name, '')) LIKE v_search_lower || '%' THEN 300
            -- Contains search term in last_name
            WHEN LOWER(COALESCE(st.last_name, '')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, '')) ILIKE v_search_like
              OR COALESCE(st.first_name, '') ILIKE v_search_like
              OR COALESCE(st.last_name, '') ILIKE v_search_like
            ) THEN 50
            ELSE 0
          END
      END AS relevance_score
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
      -- Sort by relevance score (highest first), then user-specified ordering
      relevance_score DESC,
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

GRANT EXECUTE ON FUNCTION search_staff_admin TO authenticated;

COMMENT ON FUNCTION search_staff_admin IS 'Admin search function for staff with exact + fuzzy matching on names. Results are ranked by relevance: exact matches in name fields are prioritized over class matches. Supports filtering by statuses and subject_ids. Returns staff with class relationships.';
