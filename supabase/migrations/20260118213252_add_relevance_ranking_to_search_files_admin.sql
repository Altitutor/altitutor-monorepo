-- Migration: Add relevance-based ranking to search_files_admin
-- Description: Prioritize exact matches and matches in title fields over filename matches
-- Ranking priority:
--   1. Exact match in concatenated title (subject shortname + code + topic name)
--   2. Starts with search term in title
--   3. Contains search term in title
--   4. Exact match in filename
--   5. Starts with search term in filename
--   6. Contains search term in filename
--   7. Alphabetical fallback (subject name, topic name, index)

CREATE OR REPLACE FUNCTION search_files_admin(
  -- Search
  p_search TEXT DEFAULT NULL,
  
  -- Filters
  p_subject_ids UUID[] DEFAULT NULL,
  p_topic_ids UUID[] DEFAULT NULL,
  p_file_types TEXT[] DEFAULT NULL,  -- resource_type enum values
  
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
  v_file_ids UUID[];
  v_files JSONB;
  v_total_count BIGINT;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('files', '[]'::jsonb, 'total', 0);
  END IF;

  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  -- Build file ID list from search (if search provided)
  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT file_id), ARRAY[]::UUID[])
    INTO v_file_ids
    FROM (
      -- Search by subject shortname + file code + file type + topic name + file name (concatenated)
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          LOWER(
            CONCAT_WS(' ',
              format_subject_short_name(s.curriculum::text, s.year_level, s.name),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            )
          ) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ',
              format_subject_short_name(s.curriculum::text, s.year_level, s.name),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            ) ILIKE v_search_like
          ))
        )
      
      UNION
      
      -- Search by subject longname + file code + file type + topic name + file name (concatenated)
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          LOWER(
            CONCAT_WS(' ',
              format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            )
          ) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            CONCAT_WS(' ',
              format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
              tf.code,
              tf.type::text,
              t.name,
              f.filename
            ) ILIKE v_search_like
          ))
        )
      
      UNION
      
      -- Search by individual fields for better coverage and partial matching
      SELECT DISTINCT tf.file_id
      FROM topics_files tf
      JOIN topics t ON t.id = tf.topic_id
      JOIN subjects s ON s.id = t.subject_id
      JOIN files f ON f.id = tf.file_id
      WHERE f.deleted_at IS NULL
        AND (
          -- Subject shortname/longname
          LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%'
          OR LOWER(format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level)) LIKE '%' || v_search_lower || '%'
          -- File code
          OR LOWER(COALESCE(tf.code, '')) LIKE '%' || v_search_lower || '%'
          -- File type
          OR LOWER(tf.type::text) LIKE '%' || v_search_lower || '%'
          -- Topic name
          OR LOWER(COALESCE(t.name, '')) LIKE '%' || v_search_lower || '%'
          -- File name
          OR LOWER(COALESCE(f.filename, '')) LIKE '%' || v_search_lower || '%'
          -- Fuzzy matching
          OR (v_search_like IS NOT NULL AND (
            format_subject_short_name(s.curriculum::text, s.year_level, s.name) ILIKE v_search_like
            OR format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level) ILIKE v_search_like
            OR COALESCE(tf.code, '') ILIKE v_search_like
            OR tf.type::text ILIKE v_search_like
            OR COALESCE(t.name, '') ILIKE v_search_like
            OR COALESCE(f.filename, '') ILIKE v_search_like
          ))
        )
    ) search_results;
  END IF;

  -- Build main query with filters and relevance scoring
  WITH filtered_files AS (
    SELECT DISTINCT
      tf.id AS topics_file_id,
      tf.topic_id,
      tf.type,
      tf.index,
      tf.code,
      tf.file_id,
      tf.is_solutions,
      tf.created_at,
      tf.updated_at,
      tf.created_by,
      -- File details
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.metadata AS file_metadata,
      -- Topic details
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      -- Subject details
      s.id AS subject_id,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name,
      -- Relevance scoring (only when search is provided)
      CASE 
        WHEN v_search_lower IS NULL THEN 0
        ELSE
          -- Build concatenated title: subject shortname + code + topic name
          CASE 
            -- Exact match in title (highest priority)
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_short_name(s.curriculum::text, s.year_level, s.name),
                COALESCE(tf.code, ''),
                t.name
              )
            ) = v_search_lower THEN 1000
            -- Starts with search term in title
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_short_name(s.curriculum::text, s.year_level, s.name),
                COALESCE(tf.code, ''),
                t.name
              )
            ) LIKE v_search_lower || '%' THEN 900
            -- Contains search term in title
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_short_name(s.curriculum::text, s.year_level, s.name),
                COALESCE(tf.code, ''),
                t.name
              )
            ) LIKE '%' || v_search_lower || '%' THEN 800
            -- Exact match in longname title
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
                COALESCE(tf.code, ''),
                t.name
              )
            ) = v_search_lower THEN 750
            -- Starts with search term in longname title
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
                COALESCE(tf.code, ''),
                t.name
              )
            ) LIKE v_search_lower || '%' THEN 700
            -- Contains search term in longname title
            WHEN LOWER(
              CONCAT_WS(' ',
                format_subject_long_name(s.curriculum::text, s.year_level, s.name, s.level),
                COALESCE(tf.code, ''),
                t.name
              )
            ) LIKE '%' || v_search_lower || '%' THEN 600
            -- Exact match in filename
            WHEN LOWER(COALESCE(f.filename, '')) = v_search_lower THEN 500
            -- Starts with search term in filename
            WHEN LOWER(COALESCE(f.filename, '')) LIKE v_search_lower || '%' THEN 400
            -- Contains search term in filename
            WHEN LOWER(COALESCE(f.filename, '')) LIKE '%' || v_search_lower || '%' THEN 300
            -- Individual field matches (lower priority)
            WHEN LOWER(format_subject_short_name(s.curriculum::text, s.year_level, s.name)) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(COALESCE(tf.code, '')) LIKE '%' || v_search_lower || '%' THEN 200
            WHEN LOWER(COALESCE(t.name, '')) LIKE '%' || v_search_lower || '%' THEN 200
            -- Fuzzy match (lowest priority)
            WHEN v_search_like IS NOT NULL AND (
              CONCAT_WS(' ',
                format_subject_short_name(s.curriculum::text, s.year_level, s.name),
                COALESCE(tf.code, ''),
                t.name
              ) ILIKE v_search_like
            ) THEN 100
            ELSE 0
          END
      END AS relevance_score
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      -- Search filter: if search was provided, v_file_ids will be empty array (not NULL) when no matches
      -- If search was not provided, v_file_ids IS NULL (show all)
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.file_id = ANY(v_file_ids)))
      -- Subject filter
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      -- Topic filter
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      -- File type filter
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  paginated_files AS (
    SELECT *
    FROM filtered_files
    ORDER BY 
      -- Sort by relevance score (highest first), then alphabetical fallback
      relevance_score DESC,
      subject_name ASC,
      topic_name ASC,
      index ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', pf.topics_file_id,
        'topic_id', pf.topic_id,
        'type', pf.type,
        'index', pf.index,
        'code', pf.code,
        'file_id', pf.file_id,
        'is_solutions', pf.is_solutions,
        'created_at', pf.created_at,
        'updated_at', pf.updated_at,
        'created_by', pf.created_by,
        'file', jsonb_build_object(
          'id', pf.file_id,
          'filename', pf.filename,
          'mimetype', pf.mimetype,
          'size_bytes', pf.size_bytes,
          'storage_path', pf.storage_path,
          'bucket', pf.bucket,
          'storage_provider', pf.storage_provider,
          'metadata', pf.file_metadata
        ),
        'topic', jsonb_build_object(
          'id', pf.topic_id_full,
          'name', pf.topic_name,
          'code', pf.topic_code
        ),
        'subject', jsonb_build_object(
          'id', pf.subject_id,
          'name', pf.subject_name,
          'curriculum', pf.subject_curriculum,
          'year_level', pf.subject_year_level,
          'discipline', pf.subject_discipline,
          'level', pf.subject_level,
          'color', pf.subject_color,
          'short_name', pf.subject_short_name,
          'long_name', pf.subject_long_name
        )
      )
    ),
    COUNT(*)
  INTO v_files, v_total_count
  FROM paginated_files pf;

  RETURN jsonb_build_object(
    'files', COALESCE(v_files, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION search_files_admin TO authenticated;

COMMENT ON FUNCTION search_files_admin IS 'Admin search function for files (topics_files) with exact + fuzzy matching on subject shortname/longname, file code, file type, topic name, and file name. Supports filtering by subject_ids, topic_ids, and file_types. Returns files with topic and subject relationships. Results are ranked by relevance: exact matches in title fields are prioritized over filename matches.';
