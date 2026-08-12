-- Denormalized durable AI review status for tutor catalog filter/badges.
-- Written only by the AI assessment persist module (app), never by refresh_ucat_question_catalog_projection.
-- refresh INSERT omits this column → DEFAULT 'not_requested' on new stems;
-- refresh ON CONFLICT UPDATE also omits it → existing values are preserved.

ALTER TABLE public.ucat_question_catalog_projection
  ADD COLUMN IF NOT EXISTS ai_review_status TEXT NOT NULL DEFAULT 'not_requested';

ALTER TABLE public.ucat_question_catalog_projection
  DROP CONSTRAINT IF EXISTS ucat_question_catalog_projection_ai_review_status_check;

ALTER TABLE public.ucat_question_catalog_projection
  ADD CONSTRAINT ucat_question_catalog_projection_ai_review_status_check
  CHECK (ai_review_status IN (
    'not_requested',
    'reviewing',
    'deferred',
    'format_blocked',
    'unavailable',
    'unreviewable',
    'passed',
    'concerns',
    'critical'
  ));

CREATE INDEX IF NOT EXISTS ucat_question_catalog_ai_review_status_idx
  ON public.ucat_question_catalog_projection (ai_review_status);

CREATE OR REPLACE VIEW public.vtutor_ucat_question_catalog
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns AS section_display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
  status_staff.first_name AS status_changed_by_first_name,
  status_staff.last_name AS status_changed_by_last_name,
  stem.ai_generation_metadata,
  stem.source_channel,
  stem.tutor_source_note,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  stem.created_by,
  stem.updated_by,
  stem.deleted_at,
  stem.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  projection.question_count,
  TO_JSONB(projection.set_names) AS set_names,
  projection.set_ids,
  projection.tag_ids,
  projection.question_types,
  projection.set_names_text,
  projection.stem_search_text,
  projection.question_search_text,
  projection.answer_option_search_text,
  projection.tutor_source_note_search_text,
  projection.stem_comparison_text,
  projection.stem_comparison_hash,
  projection.question_text_fingerprint,
  projection.question_bundle_fingerprint,
  projection.is_available_in_question_pool,
  projection.ai_review_status,
  ARRAY(
    SELECT DISTINCT question.response_type::TEXT
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
    ORDER BY question.response_type::TEXT
  ) AS response_types,
  ARRAY(
    SELECT DISTINCT question.answer_scheme::TEXT
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
    ORDER BY question.answer_scheme::TEXT
  ) AS answer_schemes
FROM public.question_stems stem
JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = stem.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = stem.updated_by
LEFT JOIN public.staff status_staff ON status_staff.id = stem.status_changed_by
WHERE public.is_ucat_tutor();

REVOKE ALL ON TABLE public.vtutor_ucat_question_catalog FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vtutor_ucat_question_catalog TO authenticated;

DROP FUNCTION IF EXISTS public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_question_catalog(
  p_status TEXT DEFAULT 'draft',
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_section_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_include_no_category BOOLEAN DEFAULT FALSE,
  p_tag_ids UUID[] DEFAULT NULL,
  p_access_scopes TEXT[] DEFAULT NULL,
  p_question_types TEXT[] DEFAULT NULL,
  p_set_ids UUID[] DEFAULT NULL,
  p_include_without_set BOOLEAN DEFAULT FALSE,
  p_source_channels TEXT[] DEFAULT NULL,
  p_created_by UUID[] DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_by TEXT DEFAULT NULL,
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_ids_only BOOLEAN DEFAULT FALSE,
  p_ai_review_statuses TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(
    GREATEST(COALESCE(p_page_size, 20), 1),
    CASE WHEN p_ids_only THEN 50000 ELSE 100 END
  );
  safe_search TEXT := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
  safe_like_search TEXT;
  safe_direction TEXT := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  safe_search := REPLACE(safe_search, '’', '''');
  safe_search := REPLACE(safe_search, '‘', '''');
  safe_search := REPLACE(safe_search, '“', '"');
  safe_search := REPLACE(safe_search, '”', '"');
  safe_search := REPLACE(safe_search, '‐', '-');
  safe_search := REPLACE(safe_search, '‑', '-');
  safe_search := REPLACE(safe_search, '‒', '-');
  safe_search := REPLACE(safe_search, '–', '-');
  safe_search := REPLACE(safe_search, '—', '-');
  safe_search := REPLACE(safe_search, '―', '-');
  safe_like_search := REPLACE(
    REPLACE(REPLACE(safe_search, E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'in_review', 'published') THEN
    RAISE EXCEPTION 'invalid question catalog status';
  END IF;

  IF COALESCE(CARDINALITY(p_ai_review_statuses), 0) > 0
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p_ai_review_statuses) status_value
      WHERE status_value NOT IN (
        'not_requested',
        'reviewing',
        'deferred',
        'format_blocked',
        'unavailable',
        'unreviewable',
        'passed',
        'concerns',
        'critical'
      )
    )
  THEN
    RAISE EXCEPTION 'invalid ai review status filter';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT catalog.*
    FROM public.vtutor_ucat_question_catalog catalog
    WHERE
      (
        (p_show_deleted AND catalog.deleted_at IS NOT NULL)
        OR
        (
          NOT p_show_deleted
          AND catalog.deleted_at IS NULL
          AND catalog.status::TEXT = COALESCE(p_status, 'draft')
        )
      )
      AND (
        safe_search = ''
        OR (
          ('stem_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('question_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.question_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('answer_option_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.answer_option_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('tutor_source_note' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.tutor_source_note_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
        )
      )
      AND (COALESCE(CARDINALITY(p_section_ids), 0) = 0 OR catalog.section_id = ANY(p_section_ids))
      AND (
        (COALESCE(CARDINALITY(p_category_ids), 0) = 0 AND NOT p_include_no_category)
        OR catalog.question_stem_category_id = ANY(COALESCE(p_category_ids, '{}'::UUID[]))
        OR (p_include_no_category AND catalog.question_stem_category_id IS NULL)
      )
      AND (COALESCE(CARDINALITY(p_tag_ids), 0) = 0 OR catalog.tag_ids && p_tag_ids)
      AND (
        COALESCE(CARDINALITY(p_access_scopes), 0) = 0
        OR catalog.access_scope::TEXT = ANY(p_access_scopes)
      )
      AND (
        COALESCE(CARDINALITY(p_question_types), 0) = 0
        OR catalog.question_types && p_question_types
      )
      AND (
        (COALESCE(CARDINALITY(p_set_ids), 0) = 0 AND NOT p_include_without_set)
        OR catalog.set_ids && COALESCE(p_set_ids, '{}'::UUID[])
        OR (p_include_without_set AND CARDINALITY(catalog.set_ids) = 0)
      )
      AND (
        COALESCE(CARDINALITY(p_source_channels), 0) = 0
        OR catalog.source_channel::TEXT = ANY(p_source_channels)
      )
      AND (
        COALESCE(CARDINALITY(p_ai_review_statuses), 0) = 0
        OR catalog.ai_review_status = ANY(p_ai_review_statuses)
      )
      AND (COALESCE(CARDINALITY(p_created_by), 0) = 0 OR catalog.created_by = ANY(p_created_by))
      AND (p_created_from IS NULL OR catalog.created_at >= p_created_from)
      AND (p_created_to IS NULL OR catalog.created_at <= p_created_to)
  ),
  ranked AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'asc' THEN section_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'desc' THEN section_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'asc' THEN category_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'desc' THEN category_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'asc' THEN question_count END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'desc' THEN question_count END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'asc' THEN set_names_text END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'desc' THEN set_names_text END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'type_summary' AND safe_direction = 'asc' THEN ARRAY_TO_STRING(question_types, ',') END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'type_summary' AND safe_direction = 'desc' THEN ARRAY_TO_STRING(question_types, ',') END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'asc' THEN access_scope::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'desc' THEN access_scope::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'asc' THEN source_channel::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'desc' THEN source_channel::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'asc' THEN created_at END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'desc' THEN created_at END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'asc' THEN status::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'desc' THEN status::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'asc' THEN updated_at END ASC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'desc' THEN updated_at END DESC NULLS LAST,
          id ASC
      ) AS result_ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM ranked
    WHERE result_ordinal > (safe_page - 1) * safe_page_size
      AND result_ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        CASE
          WHEN p_ids_only THEN JSONB_BUILD_OBJECT('id', id)
          ELSE TO_JSONB(page_rows)
            - 'result_ordinal'
            - 'stem_search_text'
            - 'question_search_text'
            - 'answer_option_search_text'
            - 'tutor_source_note_search_text'
            - 'stem_comparison_text'
            - 'stem_comparison_hash'
            - 'question_text_fingerprint'
            - 'question_bundle_fingerprint'
            - 'set_names_text'
        END
        ORDER BY result_ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(
    result,
    JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'total', 0, 'page', safe_page, 'pageSize', safe_page_size)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT[]
) TO authenticated;

-- Ops helper: prompt-version bump / mass invalidate without recomputing.
CREATE OR REPLACE FUNCTION public.service_ucat_invalidate_catalog_ai_review_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.ucat_question_catalog_projection
  SET ai_review_status = 'not_requested'
  WHERE ai_review_status IS DISTINCT FROM 'not_requested';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.service_ucat_invalidate_catalog_ai_review_statuses()
  FROM PUBLIC, anon, authenticated;
