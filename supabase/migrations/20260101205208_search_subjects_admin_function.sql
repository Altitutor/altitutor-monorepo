-- Migration: Create search_subjects_admin RPC function
-- Description:
--   - Create optimized RPC function for searching and filtering subjects
--   - Supports search by subject shortname and longname (exact + fuzzy matching)
--   - Supports filtering by year_level, curriculum, discipline, level
--   - Includes pagination and ordering support
--   - Returns subjects with all fields

-- ========================
-- HELPER FUNCTION FOR SUBJECT LONG NAME FORMATTING
-- ========================

-- Format subject long name
-- Format: {curriculum} {year_level} {name} {level}
-- Example: "SACE 12 Mathematics" or "IB 12 Mathematics AA HL"
CREATE OR REPLACE FUNCTION format_subject_long_name(
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT,
  p_level TEXT
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
      CASE WHEN p_name IS NOT NULL AND p_level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(p_level, '')
    )
  );
$$;

-- ========================
-- UPDATE FORMAT_SUBJECT_SHORT_NAME TO MATCH USER REQUIREMENTS
-- ========================
-- User wants: "{curriculum if IB} {year_level}{name - first 4 letters}"
-- Example: "12MATH" or "IB 12MATH"
-- Note: Only include curriculum if it's IB

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
      -- Only include curriculum if it's IB
      CASE WHEN p_curriculum = 'IB' THEN 'IB' ELSE '' END,
      CASE WHEN p_curriculum = 'IB' AND (p_year_level IS NOT NULL OR p_name IS NOT NULL) THEN ' ' ELSE '' END,
      COALESCE(p_year_level::TEXT, ''),
      UPPER(LEFT(COALESCE(p_name, ''), 4))
    )
  );
$$;

-- ========================
-- SEARCH_SUBJECTS_ADMIN FUNCTION
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
    SELECT ARRAY_AGG(DISTINCT id)
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
      -- Search filter (if provided)
      (v_subject_ids IS NULL OR s.id = ANY(v_subject_ids))
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
    (SELECT COUNT(*) FROM filtered_subjects)
  INTO v_subjects, v_total_count
  FROM paginated_subjects ps;

  -- Build result
  RETURN jsonb_build_object(
    'subjects', COALESCE(v_subjects, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- ========================
-- GRANT PERMISSIONS
-- ========================

GRANT EXECUTE ON FUNCTION format_subject_long_name TO authenticated;
GRANT EXECUTE ON FUNCTION search_subjects_admin TO authenticated;

COMMENT ON FUNCTION format_subject_long_name IS 'Format subject long name: {curriculum} {year_level} {name} {level}';
COMMENT ON FUNCTION search_subjects_admin IS 'Admin search function for subjects with exact + fuzzy matching on shortname and longname, and filtering by year_level, curriculum, discipline, and level.';
