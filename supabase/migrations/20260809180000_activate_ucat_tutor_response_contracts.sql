-- Activate canonical UCAT authoring contracts at the tutor write boundary.
-- The legacy writer remains private during the expand phase; this public wrapper
-- lets old and canonical clients coexist while making canonical fields authoritative.

ALTER FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) RENAME TO tutor_ucat_upsert_question_stem_bundle_legacy;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle_legacy(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_status public.ucat_content_status;
  v_question JSONB;
  v_question_id UUID;
  v_option JSONB;
  v_option_id UUID;
  v_response_type public.ucat_response_type;
  v_answer_scheme public.ucat_answer_scheme;
  v_answer_key public.ucat_answer_key_value;
  v_issues JSONB;
BEGIN
  v_stem_id := public.tutor_ucat_upsert_question_stem_bundle_legacy(
    p_stem_id,
    p_section_id,
    p_question_stem_category_id,
    p_stem_text,
    p_access_scope,
    p_questions,
    p_source_channel,
    p_tutor_source_note
  );

  FOR v_question IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
  LOOP
    SELECT question.id
    INTO v_question_id
    FROM public.ucat_questions question
    WHERE question.question_stem_id = v_stem_id
      AND question.deleted_at IS NULL
      AND question.index = COALESCE((v_question->>'index')::INTEGER, 1)
    ORDER BY question.id
    LIMIT 1;

    IF v_question_id IS NULL THEN
      RAISE EXCEPTION 'canonical_question_not_found';
    END IF;

    v_response_type := COALESCE(
      NULLIF(v_question->>'response_type', '')::public.ucat_response_type,
      CASE NULLIF(v_question->>'question_type', '')::public.ucat_question_type
        WHEN 'syllogism' THEN 'drag_and_drop'::public.ucat_response_type
        ELSE 'multiple_choice'::public.ucat_response_type
      END
    );
    v_answer_scheme := COALESCE(
      NULLIF(v_question->>'answer_scheme', '')::public.ucat_answer_scheme,
      CASE
        WHEN NULLIF(v_question->>'question_type', '')::public.ucat_question_type = 'syllogism'
          THEN 'decision_making_binary_placement'::public.ucat_answer_scheme
        WHEN p_section_id = '8dfbf286-e952-4581-b065-255ead834628'
          THEN 'situational_judgement_rating'::public.ucat_answer_scheme
        ELSE 'single_choice'::public.ucat_answer_scheme
      END
    );

    UPDATE public.ucat_questions
    SET response_type = v_response_type,
        answer_scheme = v_answer_scheme
    WHERE id = v_question_id;

    FOR v_option IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_question->'answer_options', '[]'::jsonb))
    LOOP
      SELECT option.id
      INTO v_option_id
      FROM public.question_answer_options option
      WHERE option.question_id = v_question_id
        AND option.deleted_at IS NULL
        AND option.index = COALESCE((v_option->>'index')::INTEGER, 1)
      ORDER BY option.id
      LIMIT 1;

      v_answer_key := CASE
        WHEN v_option ? 'answer_key_value'
          THEN NULLIF(v_option->>'answer_key_value', '')::public.ucat_answer_key_value
        WHEN v_answer_scheme = 'decision_making_binary_placement'
          AND COALESCE((v_option->>'is_answer')::BOOLEAN, false)
          THEN 'yes'::public.ucat_answer_key_value
        WHEN v_answer_scheme = 'decision_making_binary_placement'
          THEN 'no'::public.ucat_answer_key_value
        WHEN COALESCE((v_option->>'is_answer')::BOOLEAN, false)
          THEN 'correct'::public.ucat_answer_key_value
        ELSE NULL
      END;

      UPDATE public.question_answer_options
      SET answer_key_value = v_answer_key
      WHERE id = v_option_id;
    END LOOP;
  END LOOP;

  SELECT status INTO v_status FROM public.question_stems WHERE id = v_stem_id;
  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('stem', v_stem_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  RETURN v_stem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) TO authenticated;

-- Re-project the canonical fields through the stable tutor detail view.
CREATE OR REPLACE VIEW public.vtutor_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
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
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues,
  (
    SELECT json_agg(
      json_build_object(
        'id', question.id,
        'question_text', question.question_text,
        'answer_explanation', question.answer_explanation,
        'index', question.index,
        'difficulty', question.difficulty,
        'time_burden_seconds', question.time_burden_seconds,
        'question_type', question.question_type,
        'response_type', question.response_type,
        'answer_scheme', question.answer_scheme,
        'source_channel', question.source_channel,
        'ai_generation_metadata', question.ai_generation_metadata,
        'tags', (
          SELECT COALESCE(json_agg(json_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name), '[]'::json)
          FROM public.questions_question_tags question_tag
          JOIN public.question_tags tag ON tag.id = question_tag.tag_id
          WHERE question_tag.question_id = question.id
        ),
        'answer_options', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', option.id,
              'answer_text', option.answer_text,
              'answer_explanation', option.answer_explanation,
              'index', option.index,
              'is_answer', option.is_answer,
              'answer_key_value', option.answer_key_value
            ) ORDER BY option.index, option.id
          ), '[]'::json)
          FROM public.question_answer_options option
          WHERE option.question_id = question.id AND option.deleted_at IS NULL
        )
      ) ORDER BY question.index, question.id
    )
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;

-- Candidate/content snapshots now carry the same canonical contract while the
-- legacy keys remain available for clients still in the expansion window.
CREATE OR REPLACE FUNCTION public.ucat_question_content_snapshot(p_question_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'stem', jsonb_build_object(
      'id', stem.id,
      'sectionId', stem.section_id,
      'sectionNumber', section.section_number,
      'sectionName', section.name,
      'sectionDisplayColumns', section.display_columns,
      'categoryId', stem.question_stem_category_id,
      'categoryName', category.name,
      'categoryDescription', category.description,
      'stemText', stem.stem_text
    ),
    'question', jsonb_build_object(
      'id', question.id,
      'questionText', question.question_text,
      'answerExplanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'timeBurdenSeconds', question.time_burden_seconds,
      'questionType', question.question_type,
      'responseType', question.response_type,
      'answerScheme', question.answer_scheme,
      'tags', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'description', tag.description) ORDER BY tag.name, tag.id)
        FROM public.questions_question_tags question_tag
        JOIN public.question_tags tag ON tag.id = question_tag.tag_id
        WHERE question_tag.question_id = question.id
      ), '[]'::jsonb)
    ),
    'answerOptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', option.id,
        'answerText', option.answer_text,
        'answerExplanation', option.answer_explanation,
        'index', option.index,
        'isAnswer', option.is_answer,
        'answerKeyValue', option.answer_key_value
      ) ORDER BY option.index, option.id)
      FROM public.question_answer_options option
      WHERE option.question_id = question.id
        AND option.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
  WHERE question.id = p_question_id;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_content_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_question_content_snapshot(UUID) TO authenticated;

-- Remove legacy type-driven explanation/answer issues and replace them with
-- scheme-driven checks. Other lifecycle issues remain untouched.
CREATE OR REPLACE FUNCTION public.ucat_content_publication_issues(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB;
  v_contract_issues JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(issue), '[]'::jsonb)
  INTO v_issues
  FROM jsonb_array_elements(
    public.ucat_content_response_foundation_issues(p_content_type, p_content_id)
  ) issue
  WHERE issue->>'code' NOT IN ('missing_explanations', 'invalid_answer_structure');

  IF p_content_type <> 'stem' THEN
    RETURN v_issues;
  END IF;

  SELECT COALESCE(jsonb_agg(issue ORDER BY question_index, issue->>'code'), '[]'::jsonb)
  INTO v_contract_issues
  FROM (
    SELECT question.index AS question_index, jsonb_build_object(
      'code', 'missing_explanations',
      'message', 'Complete every explanation required by the Answer scheme.',
      'questionId', question.id
    ) AS issue
    FROM public.ucat_questions question
    WHERE question.question_stem_id = p_content_id
      AND question.deleted_at IS NULL
      AND CASE question.answer_scheme
        WHEN 'decision_making_binary_placement' THEN EXISTS (
          SELECT 1 FROM public.question_answer_options option
          WHERE option.question_id = question.id
            AND option.deleted_at IS NULL
            AND NOT public.ucat_rich_text_has_content(option.answer_explanation)
        )
        ELSE NOT public.ucat_rich_text_has_content(question.answer_explanation)
      END

    UNION ALL

    SELECT question.index, jsonb_build_object(
      'code', 'invalid_response_answer_key',
      'message', 'The question options and answer key do not match its Answer scheme.',
      'questionId', question.id
    )
    FROM public.ucat_questions question
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE option.deleted_at IS NULL) AS option_count,
        count(*) FILTER (WHERE option.deleted_at IS NULL AND option.answer_key_value IS NOT NULL) AS keyed_count,
        count(*) FILTER (WHERE option.deleted_at IS NULL AND option.answer_key_value = 'correct') AS correct_count,
        count(*) FILTER (WHERE option.deleted_at IS NULL AND option.answer_key_value IN ('yes', 'no')) AS binary_count,
        count(*) FILTER (WHERE option.deleted_at IS NULL AND option.answer_key_value = 'most') AS most_count,
        count(*) FILTER (WHERE option.deleted_at IS NULL AND option.answer_key_value = 'least') AS least_count,
        bool_or(option.deleted_at IS NULL AND NOT public.ucat_rich_text_has_content(option.answer_text)) AS has_blank_option
      FROM public.question_answer_options option
      WHERE option.question_id = question.id
    ) answer_key ON TRUE
    WHERE question.question_stem_id = p_content_id
      AND question.deleted_at IS NULL
      AND (
        NOT public.ucat_rich_text_has_content(question.question_text)
        OR COALESCE(answer_key.has_blank_option, false)
        OR question.response_type IS NULL
        OR question.answer_scheme IS NULL
        OR CASE question.answer_scheme
          WHEN 'single_choice' THEN answer_key.option_count < 2 OR answer_key.correct_count <> 1 OR answer_key.keyed_count <> 1
          WHEN 'situational_judgement_rating' THEN answer_key.option_count <> 4 OR answer_key.correct_count <> 1 OR answer_key.keyed_count <> 1
          WHEN 'decision_making_binary_placement' THEN answer_key.option_count <> 5 OR answer_key.binary_count <> 5 OR answer_key.keyed_count <> 5
          WHEN 'situational_judgement_most_least' THEN answer_key.option_count <> 3 OR answer_key.most_count <> 1 OR answer_key.least_count <> 1 OR answer_key.keyed_count <> 2
          ELSE TRUE
        END
      )
  ) contract_issue;

  v_issues := v_issues || v_contract_issues;

  IF EXISTS (
    SELECT 1 FROM public.ucat_questions question
    WHERE question.question_stem_id = p_content_id
      AND question.deleted_at IS NULL
      AND question.answer_scheme = 'situational_judgement_most_least'
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'sj_most_least_not_activated',
      'message', 'Most/Least Appropriate publication is not activated yet.'
    ));
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

-- Catalog consumers receive taxonomy and response axes independently. The
-- existing legacy question_types column remains during expansion.
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
