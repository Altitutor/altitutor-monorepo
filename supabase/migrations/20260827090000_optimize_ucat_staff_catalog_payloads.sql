-- Keep whole-bank tutor workflows on compact, purpose-built payloads. Detailed
-- stem JSON remains available through the ID-scoped detail view for editors.

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_stem_picker_catalog(
  p_after_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 500,
  p_published_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT
      stem.id,
      stem.stem_text,
      stem.section_id,
      section.section_number,
      section.name AS section_name,
      stem.question_stem_category_id,
      category.name AS category_name,
      stem.status,
      stem.access_scope,
      stem.source_channel,
      stem.created_at,
      projection.question_count,
      projection.tag_ids,
      projection.set_ids,
      projection.set_names,
      projection.question_search_text,
      projection.answer_option_search_text
    FROM public.question_stems stem
    JOIN public.ucat_question_catalog_projection projection
      ON projection.stem_id = stem.id
    JOIN public.ucat_sections section ON section.id = stem.section_id
    LEFT JOIN public.question_stem_categories category
      ON category.id = stem.question_stem_category_id
    WHERE stem.deleted_at IS NULL
      AND (NOT COALESCE(p_published_only, FALSE) OR stem.status::TEXT = 'published')
      AND (p_after_id IS NULL OR stem.id > p_after_id)
    ORDER BY stem.id
    LIMIT safe_limit + 1
  ),
  page_rows AS (
    SELECT *
    FROM candidates
    ORDER BY id
    LIMIT safe_limit
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', page_rows.id,
          'stem_text', page_rows.stem_text,
          'section_id', page_rows.section_id,
          'section_number', page_rows.section_number,
          'section_name', page_rows.section_name,
          'question_stem_category_id', page_rows.question_stem_category_id,
          'category_name', page_rows.category_name,
          'status', page_rows.status,
          'access_scope', page_rows.access_scope,
          'source_channel', page_rows.source_channel,
          'created_at', page_rows.created_at,
          'question_count', page_rows.question_count,
          'tag_ids', page_rows.tag_ids,
          'set_ids', page_rows.set_ids,
          'set_names', page_rows.set_names,
          'question_search_text', page_rows.question_search_text,
          'answer_option_search_text', page_rows.answer_option_search_text,
          'questions', COALESCE((
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', question.id,
                'index', question.index,
                'response_type', question.response_type,
                'answer_scheme', question.answer_scheme,
                'option_ids', COALESCE((
                  SELECT JSONB_AGG(answer_option.id ORDER BY answer_option.index, answer_option.id)
                  FROM public.question_answer_options answer_option
                  WHERE answer_option.question_id = question.id
                    AND answer_option.deleted_at IS NULL
                ), '[]'::JSONB)
              )
              ORDER BY question.index, question.id
            )
            FROM public.ucat_questions question
            WHERE question.question_stem_id = page_rows.id
              AND question.deleted_at IS NULL
          ), '[]'::JSONB)
        )
        ORDER BY page_rows.id
      ),
      '[]'::JSONB
    ),
    'nextCursor', CASE
      WHEN (SELECT COUNT(*) FROM candidates) > safe_limit
      THEN (SELECT id::TEXT FROM page_rows ORDER BY id DESC LIMIT 1)
      ELSE NULL
    END
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(result, JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'nextCursor', NULL));
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_stem_picker_catalog(UUID, INTEGER, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_stem_picker_catalog(UUID, INTEGER, BOOLEAN)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_reconciliation_content_issues(
  p_feedback_question_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stems_with_no_category JSONB;
  questions_with_no_explanation JSONB;
  untagged_questions JSONB;
  feedback_questions JSONB;
  private_stems_not_in_set JSONB;
  stems_in_multiple_sets JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  IF CARDINALITY(COALESCE(p_feedback_question_ids, '{}'::UUID[])) > 1000 THEN
    RAISE EXCEPTION 'too many feedback question ids' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', stem.id,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'stemText', stem.stem_text,
      'questions', COALESCE((
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', question.id,
            'question_text', question.question_text,
            'index', question.index,
            'answer_options', COALESCE((
              SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT('answer_text', answer_option.answer_text)
                ORDER BY answer_option.index, answer_option.id
              )
              FROM public.question_answer_options answer_option
              WHERE answer_option.question_id = question.id
                AND answer_option.deleted_at IS NULL
            ), '[]'::JSONB)
          )
          ORDER BY question.index, question.id
        )
        FROM public.ucat_questions question
        WHERE question.question_stem_id = stem.id
          AND question.deleted_at IS NULL
      ), '[]'::JSONB)
    )
    ORDER BY section.section_number, stem.id
  ), '[]'::JSONB)
  INTO stems_with_no_category
  FROM public.question_stems stem
  JOIN public.ucat_sections section ON section.id = stem.section_id
  WHERE stem.deleted_at IS NULL
    AND stem.question_stem_category_id IS NULL;

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'stemId', stem.id,
      'stemText', stem.stem_text,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'questionId', question.id,
      'questionText', question.question_text,
      'questionIndex', question.index
    )
    ORDER BY section.section_number, stem.id, question.index, question.id
  ), '[]'::JSONB)
  INTO questions_with_no_explanation
  FROM public.question_stems stem
  JOIN public.ucat_sections section ON section.id = stem.section_id
  JOIN public.ucat_questions question ON question.question_stem_id = stem.id
  WHERE stem.deleted_at IS NULL
    AND question.deleted_at IS NULL
    AND NULLIF(BTRIM(public.extract_text_from_prosemirror_json(question.answer_explanation)), '') IS NULL
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id
          AND answer_option.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id
          AND answer_option.deleted_at IS NULL
          AND NULLIF(BTRIM(public.extract_text_from_prosemirror_json(answer_option.answer_explanation)), '') IS NULL
      )
    );

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'stemId', stem.id,
      'stemText', stem.stem_text,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'questionId', question.id,
      'questionText', question.question_text,
      'questionIndex', question.index,
      'answerOptions', COALESCE((
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT('answer_text', answer_option.answer_text)
          ORDER BY answer_option.index, answer_option.id
        )
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id
          AND answer_option.deleted_at IS NULL
      ), '[]'::JSONB)
    )
    ORDER BY section.section_number, stem.id, question.index, question.id
  ), '[]'::JSONB)
  INTO untagged_questions
  FROM public.question_stems stem
  JOIN public.ucat_sections section ON section.id = stem.section_id
  JOIN public.ucat_questions question ON question.question_stem_id = stem.id
  WHERE stem.deleted_at IS NULL
    AND question.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.questions_question_tags question_tag
      WHERE question_tag.question_id = question.id
    );

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'stemId', stem.id,
      'stemText', stem.stem_text,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'questionId', question.id,
      'questionText', question.question_text,
      'questionIndex', question.index
    )
    ORDER BY stem.id, question.index, question.id
  ), '[]'::JSONB)
  INTO feedback_questions
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  WHERE question.id = ANY(COALESCE(p_feedback_question_ids, '{}'::UUID[]))
    AND question.deleted_at IS NULL
    AND stem.deleted_at IS NULL;

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', stem.id,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'categoryId', stem.question_stem_category_id,
      'categoryName', category.name,
      'stemText', stem.stem_text,
      'questions', '[]'::JSONB
    )
    ORDER BY section.section_number, stem.id
  ), '[]'::JSONB)
  INTO private_stems_not_in_set
  FROM public.question_stems stem
  JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category
    ON category.id = stem.question_stem_category_id
  WHERE stem.deleted_at IS NULL
    AND stem.access_scope::TEXT = 'private'
    AND CARDINALITY(projection.set_ids) = 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.ucat_sessions_resources session_resource
      WHERE session_resource.question_stem_id = stem.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks block
      LEFT JOIN public.ucat_questions attached_question ON attached_question.id = block.question_id
      WHERE block.deleted_at IS NULL
        AND (
          block.question_stem_id = stem.id
          OR attached_question.question_stem_id = stem.id
        )
    );

  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', stem.id,
      'sectionId', stem.section_id,
      'sectionName', section.name,
      'categoryId', stem.question_stem_category_id,
      'categoryName', category.name,
      'stemText', stem.stem_text,
      'sets', COALESCE((
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', set_id,
            'name', COALESCE(
              NULLIF(public.extract_text_from_prosemirror_json(
                projection.set_names -> ((ordinality - 1)::INTEGER)
              ), ''),
              'Untitled'
            )
          )
          ORDER BY ordinality
        )
        FROM UNNEST(projection.set_ids) WITH ORDINALITY AS member(set_id, ordinality)
      ), '[]'::JSONB),
      'questions', '[]'::JSONB
    )
    ORDER BY CARDINALITY(projection.set_ids) DESC, stem.id
  ), '[]'::JSONB)
  INTO stems_in_multiple_sets
  FROM public.question_stems stem
  JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category
    ON category.id = stem.question_stem_category_id
  WHERE stem.deleted_at IS NULL
    AND CARDINALITY(projection.set_ids) > 1;

  RETURN JSONB_BUILD_OBJECT(
    'stemsWithNoCategory', stems_with_no_category,
    'questionsWithNoExplanation', questions_with_no_explanation,
    'untaggedQuestions', untagged_questions,
    'feedbackQuestions', feedback_questions,
    'privateStemsNotInSet', private_stems_not_in_set,
    'stemsInMultipleSets', stems_in_multiple_sets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_reconciliation_content_issues(UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_reconciliation_content_issues(UUID[])
  TO authenticated;

-- The private-stem queue still returns rich question text for its visible page,
-- but no longer materializes the detail view for the entire bank before paging.
CREATE OR REPLACE FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  p_search TEXT DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      stem.id,
      stem.section_id,
      section.name AS section_name,
      stem.question_stem_category_id,
      category.name AS category_name,
      stem.stem_text,
      stem.updated_at
    FROM public.question_stems stem
    JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
    JOIN public.ucat_sections section ON section.id = stem.section_id
    LEFT JOIN public.question_stem_categories category
      ON category.id = stem.question_stem_category_id
    WHERE stem.deleted_at IS NULL
      AND stem.access_scope::TEXT = 'private'
      AND CARDINALITY(projection.set_ids) = 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_sessions_resources session_resource
        WHERE session_resource.question_stem_id = stem.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_learning_module_blocks block
        LEFT JOIN public.ucat_questions attached_question ON attached_question.id = block.question_id
        WHERE block.deleted_at IS NULL
          AND (
            block.question_stem_id = stem.id
            OR attached_question.question_stem_id = stem.id
          )
      )
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR stem.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR projection.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(section.name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  numbered AS (
    SELECT filtered.*, ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, id) AS ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM numbered
    WHERE ordinal > (safe_page - 1) * safe_page_size
      AND ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items', COALESCE(JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', page_rows.id,
        'sectionId', page_rows.section_id,
        'sectionName', page_rows.section_name,
        'categoryId', page_rows.question_stem_category_id,
        'categoryName', page_rows.category_name,
        'stemText', page_rows.stem_text,
        'questions', COALESCE((
          SELECT JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', question.id,
              'question_text', question.question_text,
              'index', question.index,
              'answer_options', COALESCE((
                SELECT JSONB_AGG(
                  JSONB_BUILD_OBJECT('answer_text', answer_option.answer_text)
                  ORDER BY answer_option.index, answer_option.id
                )
                FROM public.question_answer_options answer_option
                WHERE answer_option.question_id = question.id
                  AND answer_option.deleted_at IS NULL
              ), '[]'::JSONB)
            )
            ORDER BY question.index, question.id
          )
          FROM public.ucat_questions question
          WHERE question.question_stem_id = page_rows.id
            AND question.deleted_at IS NULL
        ), '[]'::JSONB)
      )
      ORDER BY page_rows.ordinal
    ), '[]'::JSONB),
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

REVOKE ALL ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(TEXT, UUID[], INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(TEXT, UUID[], INTEGER, INTEGER)
  TO authenticated;

-- Trigger functions are invoked by their triggers, never through PostgREST.
REVOKE ALL ON FUNCTION public.enforce_ucat_practice_attempt_quota()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ucat_content_release()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_ucat_public_question_counts_cache()
  FROM PUBLIC, anon, authenticated;
