-- A question-stem bundle is one aggregate mutation, but its storage writer
-- performs several statements across the stem, questions, answer options, and
-- tags. Each statement used to rebuild the same catalog projection. Defer those
-- trigger-driven rebuilds while the aggregate writer is active, then rebuild
-- the completed stem exactly once before returning.

CREATE OR REPLACE FUNCTION public.ucat_catalog_refresh_is_deferred()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    current_setting('altitutor.defer_ucat_catalog_refresh', TRUE),
    'off'
  ) = 'on';
$$;

REVOKE ALL ON FUNCTION public.ucat_catalog_refresh_is_deferred()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_stems()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.ucat_catalog_refresh_is_deferred() THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT id FROM new_rows)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT id FROM old_rows)
    );
  ELSE
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT id FROM new_rows UNION SELECT id FROM old_rows)
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.ucat_catalog_refresh_is_deferred() THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM new_rows)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM old_rows)
    );
  ELSE
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(
        SELECT question_stem_id FROM new_rows
        UNION
        SELECT question_stem_id FROM old_rows
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  question_ids UUID[];
BEGIN
  IF public.ucat_catalog_refresh_is_deferred() THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    question_ids := ARRAY(SELECT question_id FROM new_rows);
  ELSIF TG_OP = 'DELETE' THEN
    question_ids := ARRAY(SELECT question_id FROM old_rows);
  ELSE
    question_ids := ARRAY(
      SELECT question_id FROM new_rows
      UNION
      SELECT question_id FROM old_rows
    );
  END IF;
  PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
    ARRAY(
      SELECT DISTINCT question.question_stem_id
      FROM public.ucat_questions question
      WHERE question.id = ANY(COALESCE(question_ids, '{}'::UUID[]))
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  question_ids UUID[];
BEGIN
  IF public.ucat_catalog_refresh_is_deferred() THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    question_ids := ARRAY(SELECT question_id FROM new_rows);
  ELSIF TG_OP = 'DELETE' THEN
    question_ids := ARRAY(SELECT question_id FROM old_rows);
  ELSE
    question_ids := ARRAY(
      SELECT question_id FROM new_rows
      UNION
      SELECT question_id FROM old_rows
    );
  END IF;
  PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
    ARRAY(
      SELECT DISTINCT question.question_stem_id
      FROM public.ucat_questions question
      WHERE question.id = ANY(COALESCE(question_ids, '{}'::UUID[]))
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
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
  v_refresh_was_deferred BOOLEAN;
BEGIN
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'invalid_questions_payload';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_questions) question
    WHERE NOT (question ? 'response_type')
      OR NOT (question ? 'answer_scheme')
      OR question->>'response_type' IS NULL
      OR question->>'response_type' NOT IN ('multiple_choice', 'drag_and_drop')
      OR question->>'answer_scheme' IS NULL
      OR question->>'answer_scheme' NOT IN (
        'single_choice', 'situational_judgement_rating',
        'decision_making_binary_placement', 'situational_judgement_most_least'
      )
      OR jsonb_typeof(question->'answer_options') IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(question->'answer_options') option
        WHERE NOT (option ? 'answer_key_value')
          OR (
            jsonb_typeof(option->'answer_key_value') <> 'null'
            AND option->>'answer_key_value' NOT IN ('correct', 'yes', 'no', 'most', 'least')
          )
      )
  ) THEN
    RAISE EXCEPTION 'canonical_response_contract_required';
  END IF;

  v_refresh_was_deferred := public.ucat_catalog_refresh_is_deferred();
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh', 'on', TRUE);
  BEGIN
    v_stem_id := public.tutor_ucat_upsert_stem_with_blueprint_guard(
      p_stem_id, p_section_id, p_question_stem_category_id, p_stem_text,
      p_access_scope, p_questions, p_source_channel, p_tutor_source_note
    );
    IF NOT v_refresh_was_deferred THEN
      PERFORM public.refresh_ucat_question_catalog_projection(v_stem_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'altitutor.defer_ucat_catalog_refresh',
      CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    RAISE;
  END;
  PERFORM set_config(
    'altitutor.defer_ucat_catalog_refresh',
    CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );
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
) TO authenticated, service_role;
