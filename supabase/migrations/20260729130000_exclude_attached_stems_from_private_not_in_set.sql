-- Exclude private stems that are already attached to a learning module or session
-- from the "private not in set" reconciliation queue.

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  p_search TEXT DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  safe_search TEXT := LOWER(BTRIM(COALESCE(p_search, '')));
  safe_like_search TEXT := REPLACE(
    REPLACE(REPLACE(LOWER(BTRIM(COALESCE(p_search, ''))), E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      catalog.id,
      catalog.section_id,
      catalog.section_name,
      catalog.question_stem_category_id,
      catalog.category_name,
      catalog.stem_text,
      detail.questions,
      catalog.updated_at
    FROM public.vtutor_ucat_question_catalog catalog
    JOIN public.vtutor_ucat_question_stem_detail detail ON detail.id = catalog.id
    WHERE catalog.deleted_at IS NULL
      AND catalog.access_scope::TEXT = 'private'
      AND CARDINALITY(catalog.set_ids) = 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_sessions_resources session_resource
        WHERE session_resource.question_stem_id = catalog.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_learning_module_blocks block
        LEFT JOIN public.ucat_questions question ON question.id = block.question_id
        WHERE block.deleted_at IS NULL
          AND (
            block.question_stem_id = catalog.id
            OR question.question_stem_id = catalog.id
          )
      )
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR catalog.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(catalog.section_name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  numbered AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, id) AS ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT * FROM numbered
    WHERE ordinal > (safe_page - 1) * safe_page_size
      AND ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', id,
          'sectionId', section_id,
          'sectionName', section_name,
          'categoryId', question_stem_category_id,
          'categoryName', category_name,
          'stemText', stem_text,
          'questions', questions
        )
        ORDER BY ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  TEXT, UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  TEXT, UUID[], INTEGER, INTEGER
) TO authenticated;
