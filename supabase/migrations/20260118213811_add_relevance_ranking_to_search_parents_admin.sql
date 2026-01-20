-- Migration: Add relevance-based ranking to search_parents_admin
-- Description: Prioritize exact matches in parent names over linked student name matches
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
--   10. Matches in linked student names (lower priority)
--   11. Fuzzy match
--   12. User-specified ordering fallback

CREATE OR REPLACE FUNCTION search_parents_admin(
  p_search TEXT DEFAULT NULL,
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
  v_parent_ids UUID[];
  v_parents JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('parents', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build parent ID list from search
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_parent_ids
    FROM (
      -- Search by parent names (exact + fuzzy matching) - NO email/phone search
      SELECT id
      FROM parents
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
      
      UNION
      
      -- Search by linked student names (exact + fuzzy matching)
      SELECT DISTINCT ps.parent_id
      FROM parents_students ps
      JOIN students s ON s.id = ps.student_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(s.first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(s.last_name, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, '')) ILIKE v_search_like
           OR COALESCE(s.first_name, '') ILIKE v_search_like
           OR COALESCE(s.last_name, '') ILIKE v_search_like
         ))
    ) search_results;
  END IF;

  -- Build main query with relevance scoring
  WITH filtered_parents AS (
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.created_at,
      p.updated_at,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          CASE 
            -- Exact match in full name (highest priority)
            WHEN LOWER(CONCAT_WS(' ', COALESCE(p.first_name, ''), COALESCE(p.last_name, ''))) = v_search_lower THEN 1000
            -- Starts with search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(p.first_name, ''), COALESCE(p.last_name, ''))) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in full name
            WHEN LOWER(CONCAT_WS(' ', COALESCE(p.first_name, ''), COALESCE(p.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in first_name
            WHEN LOWER(COALESCE(p.first_name, '')) = v_search_lower THEN 700
            -- Starts with search term in first_name
            WHEN LOWER(COALESCE(p.first_name, '')) LIKE v_search_lower || '%' THEN 600
            -- Contains search term in first_name
            WHEN LOWER(COALESCE(p.first_name, '')) LIKE '%' || v_search_lower || '%' THEN 500
            -- Exact match in last_name
            WHEN LOWER(COALESCE(p.last_name, '')) = v_search_lower THEN 400
            -- Starts with search term in last_name
            WHEN LOWER(COALESCE(p.last_name, '')) LIKE v_search_lower || '%' THEN 300
            -- Contains search term in last_name
            WHEN LOWER(COALESCE(p.last_name, '')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Matches in linked student names (lower priority)
            WHEN EXISTS (
              SELECT 1 FROM parents_students ps
              JOIN students s ON s.id = ps.student_id
              WHERE ps.parent_id = p.id
                AND LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%'
            ) THEN 100
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              CONCAT_WS(' ', COALESCE(p.first_name, ''), COALESCE(p.last_name, '')) ILIKE v_search_like
              OR COALESCE(p.first_name, '') ILIKE v_search_like
              OR COALESCE(p.last_name, '') ILIKE v_search_like
            ) THEN 50
            ELSE 0
          END
      END AS relevance_score
    FROM parents p
    WHERE (v_parent_ids IS NULL OR (array_length(v_parent_ids, 1) > 0 AND p.id = ANY(v_parent_ids)))
  ),
  paginated_parents AS (
    SELECT *
    FROM filtered_parents
    ORDER BY 
      -- Sort by relevance score (highest first), then user-specified ordering
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'email' AND p_ascending THEN email END ASC,
      CASE WHEN p_order_by = 'email' AND NOT p_ascending THEN email END DESC,
      last_name ASC  -- Default fallback
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', pp.id,
        'first_name', pp.first_name,
        'last_name', pp.last_name,
        'email', pp.email,
        'phone', pp.phone,
        'created_at', pp.created_at,
        'updated_at', pp.updated_at,
        'students', CASE 
          WHEN p_include_relationships THEN (
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
            FROM parents_students ps2
            JOIN students s ON s.id = ps2.student_id
            WHERE ps2.parent_id = pp.id
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_parents)
  INTO v_parents, v_total_count
  FROM paginated_parents pp;

  -- Build result
  RETURN jsonb_build_object(
    'parents', COALESCE(v_parents, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION search_parents_admin TO authenticated;

COMMENT ON FUNCTION search_parents_admin IS 'Admin search function for parents with exact + fuzzy name matching and linked student name search. Results are ranked by relevance: exact matches in parent names are prioritized over linked student name matches. Email and phone search removed - name-only search. Returns phone and email fields.';
