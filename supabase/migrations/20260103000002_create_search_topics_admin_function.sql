-- Migration: Create search_topics_admin RPC function
-- Description:
--   - Create optimized RPC function for searching topics
--   - Supports search by "{subject shortname/longname} {code} {name}" (exact + fuzzy matching)
--   - Supports filtering by subject_id
--   - Includes pagination
--   - Returns topics with subject info
--   - Sorts by subject name alphabetically, then by topic index

-- ========================
-- SEARCH_TOPICS_ADMIN FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION search_topics_admin(
  -- Search
  p_search TEXT DEFAULT NULL,
  
  -- Filters
  p_subject_ids UUID[] DEFAULT NULL,
  
  -- Pagination
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
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
  v_topic_ids UUID[];
  v_topics JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('topics', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build topic ID list from search (if search provided)
  -- Use recursive CTE to build topic codes for search
  IF v_search_lower IS NOT NULL THEN
    WITH RECURSIVE topic_codes AS (
      -- Base case: root topics (no parent)
      SELECT 
        t.id,
        t.index::TEXT AS code,
        t.name,
        t.subject_id,
        1 AS depth
      FROM topics t
      WHERE t.parent_id IS NULL
      
      UNION ALL
      
      -- Recursive case: child topics
      SELECT 
        t.id,
        tc.code || '.' || t.index::TEXT AS code,
        t.name,
        t.subject_id,
        tc.depth + 1 AS depth
      FROM topics t
      JOIN topic_codes tc ON t.parent_id = tc.id
    ),
    topics_with_codes AS (
      SELECT DISTINCT
        tc.id,
        tc.code,
        tc.name,
        tc.subject_id
      FROM topic_codes tc
    )
    SELECT COALESCE(ARRAY_AGG(DISTINCT topic_id), ARRAY[]::UUID[])
    INTO v_topic_ids
    FROM (
      -- Search by subject shortname + topic code + topic name
      SELECT DISTINCT twc.id AS topic_id
      FROM topics_with_codes twc
      JOIN topics t ON t.id = twc.id
      JOIN subjects s ON s.id = twc.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            twc.code,
            twc.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            twc.code,
            twc.name
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Search by subject longname + topic code + topic name
      SELECT DISTINCT twc.id AS topic_id
      FROM topics_with_codes twc
      JOIN topics t ON t.id = twc.id
      JOIN subjects s ON s.id = twc.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            twc.code,
            twc.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            twc.code,
            twc.name
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Also search by individual fields for better coverage
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(COALESCE(t.name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level)) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          COALESCE(t.name, '') ILIKE v_search_like
          OR format_subject_short_name(s.curriculum::text, s.year_level, s.name) ILIKE v_search_like
          OR format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level) ILIKE v_search_like
        ))
      )
    ) search_results;
  END IF;

  -- Build main query with filters
  WITH filtered_topics AS (
    SELECT 
      t.id,
      t.subject_id,
      t.name,
      t.parent_id,
      t.index,
      t.created_at,
      t.updated_at,
      t.created_by,
      -- Subject info
      s.id AS subject_id_full,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE 
      -- Search filter: if search was provided, v_topic_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_topic_ids IS NULL (show all)
      (v_topic_ids IS NULL OR (array_length(v_topic_ids, 1) > 0 AND t.id = ANY(v_topic_ids)))
      -- Subject filter
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
  ),
  paginated_topics AS (
    SELECT *
    FROM filtered_topics
    ORDER BY 
      -- Sort by subject name alphabetically, then by topic index
      subject_name ASC,
      index ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', pt.id,
        'subject_id', pt.subject_id,
        'name', pt.name,
        'parent_id', pt.parent_id,
        'index', pt.index,
        'created_at', pt.created_at,
        'updated_at', pt.updated_at,
        'created_by', pt.created_by,
        'subject', jsonb_build_object(
          'id', pt.subject_id_full,
          'name', pt.subject_name,
          'curriculum', pt.subject_curriculum,
          'year_level', pt.subject_year_level,
          'discipline', pt.subject_discipline,
          'level', pt.subject_level,
          'color', pt.subject_color
        )
      )
    ),
    COUNT(*)
  INTO v_topics, v_total_count
  FROM paginated_topics pt;

  RETURN jsonb_build_object(
    'topics', COALESCE(v_topics, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;
