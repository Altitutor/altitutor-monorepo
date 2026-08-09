-- Activate the canonical UCAT response contract on student delivery surfaces.
-- Legacy columns remain readable during expansion but are not authoritative.

CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_delivery
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question.id,
      'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'time_burden_seconds', question.time_burden_seconds,
      'question_type', question.question_type,
      'response_type', question.response_type,
      'answer_scheme', question.answer_scheme,
      'answer_options', (
        SELECT json_agg(json_build_object(
          'id', option.id,
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'index', option.index,
          'is_answer', option.is_answer,
          'answer_key_value', option.answer_key_value
        ) ORDER BY option.index)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id
          AND option.deleted_at IS NULL
      )
    ) ORDER BY question.index)
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible
  ON accessible.id = stem.id
JOIN public.ucat_sections section
  ON section.id = stem.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stem_delivery TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question.id,
      'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'time_burden_seconds', question.time_burden_seconds,
      'question_type', question.question_type,
      'response_type', question.response_type,
      'answer_scheme', question.answer_scheme,
      'answer_options', (
        SELECT json_agg(json_build_object(
          'id', option.id,
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'index', option.index,
          'is_answer', option.is_answer,
          'answer_key_value', option.answer_key_value,
          'selection_count', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id = option.id AND attempt.is_submitted),
          'total_answered', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id IS NOT NULL AND attempt.is_submitted),
          'percentage', COALESCE(round(
            100.0 * (SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id = option.id AND attempt.is_submitted)
            / NULLIF((SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id IS NOT NULL AND attempt.is_submitted), 0),
            1
          ), 0)
        ) ORDER BY option.index)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.deleted_at IS NULL
      )
    ) ORDER BY question.index)
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_ucat_question_attempt_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scheme public.ucat_answer_scheme;
  v_kind TEXT;
  v_selected_option_id UUID;
  v_placements JSONB;
BEGIN
  IF NEW.answer_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT question.answer_scheme
  INTO v_scheme
  FROM public.ucat_questions question
  WHERE question.id = NEW.question_id
    AND question.deleted_at IS NULL;

  IF v_scheme IS NULL
    OR NEW.answer_snapshot->>'type' <> 'ucat_response_v1'
    OR NEW.answer_snapshot->>'questionId' <> NEW.question_id::TEXT
    OR NEW.answer_snapshot->>'answerScheme' <> v_scheme::TEXT
  THEN
    RAISE EXCEPTION 'Invalid UCAT response snapshot contract';
  END IF;

  v_kind := NEW.answer_snapshot#>>'{response,kind}';
  IF v_scheme IN ('single_choice', 'situational_judgement_rating') THEN
    IF v_kind <> 'single_select' THEN
      RAISE EXCEPTION 'Invalid UCAT single-select response';
    END IF;
    IF NOT ((NEW.answer_snapshot#>'{response}') ? 'selectedOptionId') THEN
      RAISE EXCEPTION 'Invalid UCAT single-select response';
    END IF;
    IF jsonb_typeof(NEW.answer_snapshot#>'{response,selectedOptionId}') = 'string' THEN
      BEGIN
        v_selected_option_id := (NEW.answer_snapshot#>>'{response,selectedOptionId}')::UUID;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'UCAT response references an invalid option ID';
      END;
      IF NOT EXISTS (
        SELECT 1
        FROM public.question_answer_options option
        WHERE option.id = v_selected_option_id
          AND option.question_id = NEW.question_id
          AND option.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'UCAT response references an unknown option';
      END IF;
    ELSIF jsonb_typeof(NEW.answer_snapshot#>'{response,selectedOptionId}') <> 'null' THEN
      RAISE EXCEPTION 'Invalid UCAT single-select response';
    END IF;
    IF NEW.question_answer_option_id IS DISTINCT FROM v_selected_option_id THEN
      RAISE EXCEPTION 'UCAT response snapshot conflicts with the selected option column';
    END IF;
    RETURN NEW;
  END IF;

  v_placements := NEW.answer_snapshot#>'{response,placements}';
  IF v_kind <> 'placement' OR jsonb_typeof(v_placements) <> 'object' THEN
    RAISE EXCEPTION 'Invalid UCAT placement response';
  END IF;
  IF NEW.question_answer_option_id IS NOT NULL THEN
    RAISE EXCEPTION 'UCAT placement response cannot use the selected option column';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(v_placements) placement
    WHERE placement.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR NOT EXISTS (
         SELECT 1
         FROM public.question_answer_options option
         WHERE option.id::TEXT = placement.key
           AND option.question_id = NEW.question_id
           AND option.deleted_at IS NULL
       )
       OR CASE v_scheme
            WHEN 'decision_making_binary_placement'
              THEN placement.value NOT IN ('yes', 'no')
            WHEN 'situational_judgement_most_least'
              THEN placement.value NOT IN ('most', 'least')
            ELSE true
          END
  ) THEN
    RAISE EXCEPTION 'UCAT response contains an unknown option or token';
  END IF;
  IF v_scheme = 'situational_judgement_most_least'
    AND (SELECT count(*) FROM jsonb_each_text(v_placements)) <>
        (SELECT count(DISTINCT value) FROM jsonb_each_text(v_placements))
  THEN
    RAISE EXCEPTION 'Most and Least tokens may each be used only once';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ucat_question_attempt_response() FROM PUBLIC;

DROP TRIGGER IF EXISTS validate_ucat_question_attempt_response
ON public.student_question_attempts;
CREATE TRIGGER validate_ucat_question_attempt_response
BEFORE INSERT OR UPDATE OF answer_snapshot, question_id
ON public.student_question_attempts
FOR EACH ROW
WHEN (NEW.answer_snapshot IS NOT NULL)
EXECUTE FUNCTION public.validate_ucat_question_attempt_response();
