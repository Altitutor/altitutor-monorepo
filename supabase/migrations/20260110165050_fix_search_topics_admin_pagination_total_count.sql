-- Migration: Fix search_topics_admin pagination total count
-- Description:
--   - Fix bug where total count was calculated from paginated results instead of filtered results
--   - This caused pagination to only show one page even when multiple pages exist
--   - Now correctly counts total from filtered_topics before pagination

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
  -- Now using stored code column instead of calculating
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT topic_id), ARRAY[]::UUID[])
    INTO v_topic_ids
    FROM (
      -- Search by subject shortname + topic code + topic name
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            t.code,
            t.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_short_name(s.curriculum::text, s.year_level, s.name),
            t.code,
            t.name
          ) ILIKE v_search_like
        ))
      )
      
      UNION
      
      -- Search by subject longname + topic code + topic name
      SELECT DISTINCT t.id AS topic_id
      FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE (
        LOWER(
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            t.code,
            t.name
          )
        ) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          CONCAT_WS(' ',
            format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
            t.code,
            t.name
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
        OR LOWER(COALESCE(t.code, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level)) LIKE '%' || v_search_lower || '%'
        OR (v_search_like IS NOT NULL AND (
          COALESCE(t.name, '') ILIKE v_search_like
          OR COALESCE(t.code, '') ILIKE v_search_like
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
      t.code,
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
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE 
      -- Search filter: if search was provided, v_topic_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_topic_ids IS NULL (show all)
      (v_topic_ids IS NULL OR (array_length(v_topic_ids, 1) > 0 AND t.id = ANY(v_topic_ids)))
      -- Subject filter
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
  ),
  -- Get total count from filtered_topics BEFORE pagination
  total_count AS (
    SELECT COUNT(*) AS count
    FROM filtered_topics
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
        'code', pt.code,
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
          'color', pt.subject_color,
          'short_name', pt.subject_short_name,
          'long_name', pt.subject_long_name
        )
      )
    ),
    tc.count
  INTO v_topics, v_total_count
  FROM paginated_topics pt
  CROSS JOIN total_count tc;

  RETURN jsonb_build_object(
    'topics', COALESCE(v_topics, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_topics_admin IS 'Admin search function for topics with exact + fuzzy matching on shortname and longname, and filtering by subject_ids. Returns subjects with short_name and long_name fields. Fixed pagination total count bug.';

