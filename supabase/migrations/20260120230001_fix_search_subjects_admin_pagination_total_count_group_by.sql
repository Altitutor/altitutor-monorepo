-- Migration: Fix GROUP BY error in search_subjects_admin pagination fix
-- Description: When using jsonb_agg(), PostgreSQL requires non-aggregated columns
--              to be in GROUP BY or aggregated. Since total_count is a single value,
--              wrap tc.count in MAX() to satisfy the aggregate requirement.
-- Fix: Change tc.count to MAX(tc.count) in the SELECT statement.

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

  -- Build main query with filters and relevance scoring
  WITH filtered_subjects AS (
    SELECT 
      s.id,
      s.name,
      s.curriculum,
      s.year_level,
      s.discipline,
      s.level,
      s.color,
      s.short_name,
      s.long_name,
      s.created_at,
      s.updated_at,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          CASE 
            -- Exact match in subject shortname (highest priority)
            WHEN LOWER(format_subject_short_name(
              s.curriculum::text,
              s.year_level,
              s.name
            )) = v_search_lower THEN 1000
            -- Starts with search term in subject shortname
            WHEN LOWER(format_subject_short_name(
              s.curriculum::text,
              s.year_level,
              s.name
            )) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in subject shortname
            WHEN LOWER(format_subject_short_name(
              s.curriculum::text,
              s.year_level,
              s.name
            )) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in subject longname
            WHEN LOWER(format_subject_long_name(
              s.curriculum::text,
              s.year_level,
              s.name,
              s.level
            )) = v_search_lower THEN 750
            -- Starts with search term in subject longname
            WHEN LOWER(format_subject_long_name(
              s.curriculum::text,
              s.year_level,
              s.name,
              s.level
            )) LIKE v_search_lower || '%' THEN 700
            -- Contains search term in subject longname
            WHEN LOWER(format_subject_long_name(
              s.curriculum::text,
              s.year_level,
              s.name,
              s.level
            )) LIKE '%' || v_search_lower || '%' THEN 600
            -- Individual field matches (lower priority)
            WHEN LOWER(COALESCE(s.name, '')) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(COALESCE(s.curriculum::text, '')) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(COALESCE(s.level, '')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              format_subject_short_name(
                s.curriculum::text,
                s.year_level,
                s.name
              ) ILIKE v_search_like
            ) THEN 100
            ELSE 0
          END
      END AS relevance_score
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
  -- Get total count from filtered_subjects BEFORE pagination
  total_count AS (
    SELECT COUNT(*) AS count
    FROM filtered_subjects
  ),
  paginated_subjects AS (
    SELECT *
    FROM filtered_subjects
    ORDER BY 
      -- Sort by relevance score (highest first), then user-specified ordering
      relevance_score DESC,
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
        'short_name', ps.short_name,
        'long_name', ps.long_name,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at
      )
    ),
    MAX(tc.count)
  INTO v_subjects, v_total_count
  FROM paginated_subjects ps
  CROSS JOIN total_count tc;

  RETURN jsonb_build_object(
    'subjects', COALESCE(v_subjects, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION search_subjects_admin TO authenticated;

COMMENT ON FUNCTION search_subjects_admin IS 'Admin search function for subjects with exact + fuzzy matching on shortname and longname, and filtering by year_level, curriculum, discipline, and level. Results are ranked by relevance: exact matches in subject shortname/longname are prioritized over individual field matches. Returns subjects with short_name and long_name fields. Fixed pagination total count bug and GROUP BY error.';
