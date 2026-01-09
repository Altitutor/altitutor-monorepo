-- Migration: Fix column references in search functions
-- Description: Fix incorrect column references in search_topics_admin

-- Fix search_topics_admin: Use correct column name for year_level, discipline, and level
CREATE OR REPLACE FUNCTION search_topics_admin(
  p_search TEXT DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_search_lower TEXT;
  v_search_like TEXT;
  v_topic_ids UUID[];
  v_topics jsonb;
  v_total_count INTEGER;
BEGIN
  -- Normalize search term
  IF p_search IS NOT NULL AND LENGTH(TRIM(p_search)) > 0 THEN
    v_search_lower := LOWER(TRIM(p_search));
    -- For exact or near-exact matches, use ILIKE with wildcards
    IF LENGTH(v_search_lower) >= 3 THEN
      v_search_like := '%' || v_search_lower || '%';
    END IF;
  END IF;

  -- If search was provided, find matching topic IDs first
  IF v_search_lower IS NOT NULL THEN
    WITH topic_search AS (
      -- Search by topic code and name
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
    )
    SELECT ARRAY_AGG(DISTINCT topic_id)
    INTO v_topic_ids
    FROM topic_search;
  END IF;

  -- Build filtered and paginated query
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

