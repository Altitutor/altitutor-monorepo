-- Migration: Create search_subjects_public RPC function
-- Description:
--   - Create public version of subject search function for anonymous users
--   - Same search logic as search_subjects_admin but without admin access check
--   - Uses SECURITY DEFINER to bypass RLS when querying subjects table
--   - Allows anonymous users to search subjects for trial booking

CREATE OR REPLACE FUNCTION public.search_subjects_public(
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
  -- No admin check - this is a public function
  -- SECURITY DEFINER allows us to bypass RLS when querying subjects table

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

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.search_subjects_public TO anon, authenticated;

-- Ensure helper functions are accessible
GRANT EXECUTE ON FUNCTION format_subject_long_name TO anon, authenticated;
GRANT EXECUTE ON FUNCTION format_subject_short_name TO anon, authenticated;
GRANT EXECUTE ON FUNCTION build_fuzzy_like TO anon, authenticated;

COMMENT ON FUNCTION public.search_subjects_public IS 'Public search function for subjects with exact + fuzzy matching on shortname and longname, and filtering by year_level, curriculum, discipline, and level. Accessible to anonymous users for trial booking.';
