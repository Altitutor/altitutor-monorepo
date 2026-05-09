-- Migration: Add external_url to files for off-platform assets (YouTube, Vimeo, future HTTPS links).
-- Storage-backed rows: bucket + storage_path set, external_url null.
-- Link-only rows: external_url set, bucket and storage_path null.

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS external_url TEXT;

ALTER TABLE public.files
  ALTER COLUMN bucket DROP NOT NULL,
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_storage_or_external_url;

ALTER TABLE public.files
  ADD CONSTRAINT files_storage_or_external_url CHECK (
    (
      external_url IS NOT NULL
      AND btrim(external_url) <> ''
      AND bucket IS NULL
      AND storage_path IS NULL
    )
    OR
    (
      (external_url IS NULL OR btrim(external_url) = '')
      AND bucket IS NOT NULL
      AND btrim(bucket) <> ''
      AND storage_path IS NOT NULL
      AND btrim(storage_path) <> ''
    )
  );

COMMENT ON COLUMN public.files.external_url IS
  'HTTPS URL when the asset is not in Supabase storage. Mutually exclusive with bucket/storage_path.';

-- Student view: expose external_url
CREATE OR REPLACE VIEW public.vstudent_topics_files
WITH (security_invoker = false)
AS
SELECT
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.code,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at,
  f.external_url
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (SELECT id FROM public.vstudent_topics)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vstudent_topics_files TO authenticated;

-- Tutor view: expose external_url
CREATE OR REPLACE VIEW public.vtutor_topics_files
WITH (security_invoker = false)
AS
SELECT
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.code,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at,
  f.external_url
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (SELECT id FROM public.vtutor_topics)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vtutor_topics_files TO authenticated;

COMMENT ON VIEW public.vtutor_topics_files IS 'Tutor view: All topics_files for authorized topics';

-- Admin search: include external_url in file payload
CREATE OR REPLACE FUNCTION search_files_admin(
  p_search TEXT DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_topic_ids UUID[] DEFAULT NULL,
  p_file_types TEXT[] DEFAULT NULL,
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
  v_file_ids UUID[];
  v_files JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('files', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT tf.id), ARRAY[]::UUID[])
    INTO v_file_ids
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND LOWER(CONCAT_WS(' ', COALESCE(s.short_name, ''), COALESCE(tf.code, ''), COALESCE(f.filename, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

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
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.external_url,
      f.metadata AS file_metadata,
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      s.id AS subject_id,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.id = ANY(v_file_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  total_count_cte AS (
    SELECT COUNT(*) AS count FROM filtered_files
  )
  SELECT COUNT(*) INTO v_total_count FROM total_count_cte;

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
      f.filename,
      f.mimetype,
      f.size_bytes,
      f.storage_path,
      f.bucket,
      f.storage_provider,
      f.external_url,
      f.metadata AS file_metadata,
      t.id AS topic_id_full,
      t.name AS topic_name,
      t.code AS topic_code,
      s.id AS subject_id,
      s.name AS subject_name,
      s.curriculum AS subject_curriculum,
      s.year_level AS subject_year_level,
      s.discipline AS subject_discipline,
      s.level AS subject_level,
      s.color AS subject_color,
      s.short_name AS subject_short_name,
      s.long_name AS subject_long_name
    FROM topics_files tf
    JOIN topics t ON t.id = tf.topic_id
    JOIN subjects s ON s.id = t.subject_id
    JOIN files f ON f.id = tf.file_id
    WHERE f.deleted_at IS NULL
      AND (v_file_ids IS NULL OR (array_length(v_file_ids, 1) > 0 AND tf.id = ANY(v_file_ids)))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR t.subject_id = ANY(p_subject_ids))
      AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL OR tf.topic_id = ANY(p_topic_ids))
      AND (p_file_types IS NULL OR array_length(p_file_types, 1) IS NULL OR tf.type::text = ANY(p_file_types))
  ),
  paginated_files AS (
    SELECT * FROM filtered_files
    ORDER BY subject_short_name ASC, topic_name ASC, index ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(
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
        'filename', pf.filename,
        'mimetype', pf.mimetype,
        'size_bytes', pf.size_bytes,
        'storage_path', pf.storage_path,
        'bucket', pf.bucket,
        'storage_provider', pf.storage_provider,
        'external_url', pf.external_url,
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
  ) INTO v_files FROM paginated_files pf;

  RETURN jsonb_build_object('files', COALESCE(v_files, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_files_admin TO authenticated;
COMMENT ON FUNCTION search_files_admin IS 'Admin search function for files. Search only by concat subject short_name + file code + file name (ILIKE).';
