-- Expand the UCAT response model without removing legacy columns. Application
-- cutover and verified contraction are deliberately separate deployments.

CREATE TYPE public.ucat_response_type AS ENUM (
  'multiple_choice',
  'drag_and_drop'
);

CREATE TYPE public.ucat_answer_scheme AS ENUM (
  'single_choice',
  'situational_judgement_rating',
  'decision_making_binary_placement',
  'situational_judgement_most_least'
);

CREATE TYPE public.ucat_answer_key_value AS ENUM (
  'correct',
  'yes',
  'no',
  'most',
  'least'
);

CREATE TYPE public.ucat_stem_presentation_format AS ENUM (
  'passage',
  'table',
  'graph_or_chart',
  'diagram_or_image',
  'mixed',
  'other'
);

ALTER TABLE public.ucat_questions
  ADD COLUMN response_type public.ucat_response_type,
  ADD COLUMN answer_scheme public.ucat_answer_scheme;

ALTER TABLE public.question_answer_options
  ADD COLUMN answer_key_value public.ucat_answer_key_value;

ALTER TABLE public.question_stems
  ADD COLUMN presentation_format public.ucat_stem_presentation_format;

-- Current production rows are consistently classified by the legacy enum:
-- syllogism means the five-statement DM placement contract; every other row is
-- multiple choice. SJT multiple-choice questions use the rating scheme.
UPDATE public.ucat_questions question
SET
  response_type = CASE question.question_type
    WHEN 'syllogism' THEN 'drag_and_drop'::public.ucat_response_type
    ELSE 'multiple_choice'::public.ucat_response_type
  END,
  answer_scheme = CASE
    WHEN question.question_type = 'syllogism'
      THEN 'decision_making_binary_placement'::public.ucat_answer_scheme
    WHEN section.name = 'Situational Judgement'
      THEN 'situational_judgement_rating'::public.ucat_answer_scheme
    ELSE 'single_choice'::public.ucat_answer_scheme
  END
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
WHERE stem.id = question.question_stem_id;

UPDATE public.question_answer_options answer_option
SET answer_key_value = CASE
  WHEN question.question_type = 'syllogism' AND answer_option.is_answer
    THEN 'yes'::public.ucat_answer_key_value
  WHEN question.question_type = 'syllogism' AND NOT answer_option.is_answer
    THEN 'no'::public.ucat_answer_key_value
  WHEN answer_option.is_answer
    THEN 'correct'::public.ucat_answer_key_value
  ELSE NULL
END
FROM public.ucat_questions question
WHERE question.id = answer_option.question_id;

-- Fail the deployment rather than leaving any legacy row (including a
-- soft-deleted row) only half migrated. Boolean false legitimately maps to a
-- null key for choice schemes, but every DM placement target must be yes/no.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ucat_questions question
    WHERE question.response_type IS NULL
      OR question.answer_scheme IS NULL
  ) THEN
    RAISE EXCEPTION 'UCAT response-contract backfill left unmigrated questions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_answer_options answer_option
    JOIN public.ucat_questions question ON question.id = answer_option.question_id
    WHERE
      (question.answer_scheme = 'decision_making_binary_placement'
        AND answer_option.answer_key_value NOT IN ('yes', 'no'))
      OR
      (question.answer_scheme IN ('single_choice', 'situational_judgement_rating')
        AND answer_option.answer_key_value IS DISTINCT FROM CASE
          WHEN answer_option.is_answer
            THEN 'correct'::public.ucat_answer_key_value
          ELSE NULL
        END)
  ) THEN
    RAISE EXCEPTION 'UCAT answer-key backfill left inconsistent options';
  END IF;
END;
$$;

-- Expansion compatibility boundary. Old writers supply question_type/is_answer;
-- canonical writers supply response_type/answer_scheme/answer_key_value. Keep
-- both representations coherent until every caller has migrated, then remove
-- these triggers with the legacy columns during contraction.
CREATE FUNCTION public.sync_ucat_question_response_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_section_name TEXT;
  v_canonical_changed BOOLEAN;
BEGIN
  IF (NEW.response_type IS NULL) <> (NEW.answer_scheme IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'response_type and answer_scheme must be supplied together';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.response_type IS NOT NULL
    AND OLD.answer_scheme IS NOT NULL
    AND NEW.response_type IS NULL
    AND NEW.answer_scheme IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'canonical response fields cannot be cleared during expansion';
  END IF;

  v_canonical_changed := (
    TG_OP = 'INSERT' AND NEW.response_type IS NOT NULL
  ) OR (
    TG_OP = 'UPDATE' AND (
      NEW.response_type IS DISTINCT FROM OLD.response_type
      OR NEW.answer_scheme IS DISTINCT FROM OLD.answer_scheme
    )
  );

  IF v_canonical_changed THEN
    NEW.question_type := CASE NEW.answer_scheme
      WHEN 'decision_making_binary_placement'
        THEN 'syllogism'::public.ucat_question_type
      ELSE 'multiple_choice'::public.ucat_question_type
    END;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    OR NEW.question_type IS DISTINCT FROM OLD.question_type
    OR NEW.question_stem_id IS DISTINCT FROM OLD.question_stem_id
  THEN
    SELECT section.name
    INTO v_section_name
    FROM public.question_stems stem
    JOIN public.ucat_sections section ON section.id = stem.section_id
    WHERE stem.id = NEW.question_stem_id;

    NEW.response_type := CASE NEW.question_type
      WHEN 'syllogism' THEN 'drag_and_drop'::public.ucat_response_type
      ELSE 'multiple_choice'::public.ucat_response_type
    END;
    NEW.answer_scheme := CASE
      WHEN NEW.question_type = 'syllogism'
        THEN 'decision_making_binary_placement'::public.ucat_answer_scheme
      WHEN v_section_name = 'Situational Judgement'
        THEN 'situational_judgement_rating'::public.ucat_answer_scheme
      ELSE 'single_choice'::public.ucat_answer_scheme
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ucat_question_response_contract()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_ucat_question_response_contract()
  FROM authenticated;

CREATE TRIGGER sync_ucat_question_response_contract
BEFORE INSERT OR UPDATE OF
  question_stem_id,
  question_type,
  response_type,
  answer_scheme
ON public.ucat_questions
FOR EACH ROW
EXECUTE FUNCTION public.sync_ucat_question_response_contract();

CREATE FUNCTION public.sync_ucat_answer_option_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_answer_scheme public.ucat_answer_scheme;
  v_canonical_changed BOOLEAN;
BEGIN
  SELECT question.answer_scheme
  INTO v_answer_scheme
  FROM public.ucat_questions question
  WHERE question.id = NEW.question_id;

  v_canonical_changed := (
    TG_OP = 'INSERT' AND NEW.answer_key_value IS NOT NULL
  ) OR (
    TG_OP = 'UPDATE'
    AND NEW.answer_key_value IS DISTINCT FROM OLD.answer_key_value
  );

  IF v_canonical_changed THEN
    NEW.is_answer := coalesce(
      NEW.answer_key_value IN ('correct', 'yes', 'most', 'least'),
      false
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    OR NEW.is_answer IS DISTINCT FROM OLD.is_answer
    OR NEW.question_id IS DISTINCT FROM OLD.question_id
  THEN
    NEW.answer_key_value := CASE
      WHEN v_answer_scheme = 'decision_making_binary_placement' AND NEW.is_answer
        THEN 'yes'::public.ucat_answer_key_value
      WHEN v_answer_scheme = 'decision_making_binary_placement' AND NOT NEW.is_answer
        THEN 'no'::public.ucat_answer_key_value
      WHEN NEW.is_answer
        THEN 'correct'::public.ucat_answer_key_value
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ucat_answer_option_key()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_ucat_answer_option_key()
  FROM authenticated;

CREATE TRIGGER sync_ucat_answer_option_key
BEFORE INSERT OR UPDATE OF
  question_id,
  is_answer,
  answer_key_value
ON public.question_answer_options
FOR EACH ROW
EXECUTE FUNCTION public.sync_ucat_answer_option_key();

ALTER TABLE public.ucat_questions
  ADD CONSTRAINT ucat_questions_response_answer_scheme_compatible CHECK (
    response_type IS NULL
    OR answer_scheme IS NULL
    OR (response_type = 'multiple_choice' AND answer_scheme IN (
      'single_choice',
      'situational_judgement_rating'
    ))
    OR
    (response_type = 'drag_and_drop' AND answer_scheme IN (
      'decision_making_binary_placement',
      'situational_judgement_most_least'
    ))
  );

CREATE INDEX idx_ucat_questions_response_type
  ON public.ucat_questions(response_type);

CREATE INDEX idx_ucat_questions_answer_scheme
  ON public.ucat_questions(answer_scheme);

COMMENT ON COLUMN public.ucat_questions.response_type IS
  'Candidate-facing interaction. Nullable only during the expand/activate rollout; does not define answer shape or scoring.';
COMMENT ON COLUMN public.ucat_questions.answer_scheme IS
  'Versioned response contract controlling validation, persistence, scoring, and review. Nullable only during rollout.';
COMMENT ON COLUMN public.question_answer_options.answer_key_value IS
  'Scheme-specific authored key. Null means an unkeyed option or the middle Most/Least action.';
COMMENT ON COLUMN public.question_stems.presentation_format IS
  'Optional stimulus-presentation metadata independent of taxonomy and response behavior.';

-- Candidate-facing UCAT ANZ taxonomy additions. These are category records,
-- not response behavior switches.
INSERT INTO public.question_stem_categories (
  id,
  name,
  description,
  ucat_section_id,
  parent_question_stem_category_id,
  created_by,
  updated_by
)
VALUES
  (
    '24df84c6-47d7-45d3-a255-e32d23c20eef',
    'Interpreting Information and Drawing Conclusions',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Interpret written passages, tables, charts, graphs or other factual information and decide whether each conclusion follows."}]}]}'::jsonb,
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
    NULL,
    NULL,
    NULL
  ),
  (
    'd97a0bf2-aa09-4ec3-86bb-5dd5146a9a57',
    'Most/Least Appropriate',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Choose the most appropriate and least appropriate actions from three actions in one combined response item."}]}]}'::jsonb,
    '8dfbf286-e952-4581-b065-255ead834628',
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Most/Least is represented in the additive model so later tickets can build
-- against it, but publishing stays disabled until its authoring, student,
-- persistence, marking, and review paths are complete.
ALTER FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  RENAME TO ucat_content_response_foundation_issues;

REVOKE ALL ON FUNCTION public.ucat_content_response_foundation_issues(TEXT, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_content_response_foundation_issues(TEXT, UUID)
  FROM authenticated;

CREATE FUNCTION public.ucat_content_publication_issues(
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
  v_response_key_issues JSONB;
BEGIN
  v_issues := public.ucat_content_response_foundation_issues(
    p_content_type,
    p_content_id
  );

  IF p_content_type = 'stem' AND EXISTS (
    SELECT 1
    FROM public.ucat_questions question
    WHERE question.question_stem_id = p_content_id
      AND question.deleted_at IS NULL
      AND question.answer_scheme = 'situational_judgement_most_least'
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'sj_most_least_not_activated',
      'message', 'Most/Least Appropriate publication is not activated yet.'
    ));
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT coalesce(
      jsonb_agg(jsonb_build_object(
        'code', 'invalid_response_answer_key',
        'message', 'The question answer key does not match its Answer scheme.',
        'questionId', invalid_question.question_id
      ) ORDER BY invalid_question.question_index),
      '[]'::jsonb
    )
    INTO v_response_key_issues
    FROM (
      SELECT
        question.id AS question_id,
        question.index AS question_index
      FROM public.ucat_questions question
      LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE answer_option.deleted_at IS NULL) AS option_count,
          count(*) FILTER (
            WHERE answer_option.deleted_at IS NULL
              AND answer_option.answer_key_value IS NOT NULL
          ) AS keyed_count,
          count(*) FILTER (
            WHERE answer_option.deleted_at IS NULL
              AND answer_option.answer_key_value = 'correct'
          ) AS correct_count,
          count(*) FILTER (
            WHERE answer_option.deleted_at IS NULL
              AND answer_option.answer_key_value IN ('yes', 'no')
          ) AS binary_count,
          count(*) FILTER (
            WHERE answer_option.deleted_at IS NULL
              AND answer_option.answer_key_value = 'most'
          ) AS most_count,
          count(*) FILTER (
            WHERE answer_option.deleted_at IS NULL
              AND answer_option.answer_key_value = 'least'
          ) AS least_count
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id
      ) answer_key ON TRUE
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          question.response_type IS NULL
          OR question.answer_scheme IS NULL
          OR CASE question.answer_scheme
            WHEN 'single_choice' THEN
              answer_key.option_count < 2
              OR answer_key.correct_count <> 1
              OR answer_key.keyed_count <> 1
            WHEN 'situational_judgement_rating' THEN
              answer_key.option_count <> 4
              OR answer_key.correct_count <> 1
              OR answer_key.keyed_count <> 1
            WHEN 'decision_making_binary_placement' THEN
              answer_key.option_count <> 5
              OR answer_key.binary_count <> 5
              OR answer_key.keyed_count <> 5
            WHEN 'situational_judgement_most_least' THEN
              answer_key.option_count <> 3
              OR answer_key.most_count <> 1
              OR answer_key.least_count <> 1
              OR answer_key.keyed_count <> 2
            ELSE TRUE
          END
        )
    ) invalid_question;

    v_issues := v_issues || v_response_key_issues;
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) IS
  'Returns publication blockers, including the temporary Most/Least activation gate.';
