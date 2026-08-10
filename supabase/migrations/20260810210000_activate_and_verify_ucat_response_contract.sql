-- Complete the activate phase of the UCAT response-contract rollout. Legacy
-- columns remain as rollback-compatible mirrors until ALTI-545 contracts them.

CREATE TABLE public.ucat_response_contract_legacy_write_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  relation_name TEXT NOT NULL CHECK (
    relation_name IN ('ucat_questions', 'question_answer_options')
  ),
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE')),
  record_id UUID NOT NULL,
  actor_id UUID
);

CREATE INDEX idx_ucat_response_contract_legacy_writes_occurred_at
  ON public.ucat_response_contract_legacy_write_observations(occurred_at);

ALTER TABLE public.ucat_response_contract_legacy_write_observations
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ucat_response_contract_legacy_write_observations
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ucat_response_contract_legacy_write_observations_id_seq
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.ucat_response_contract_legacy_write_observations IS
  'Temporary compatibility-window evidence for legacy-only UCAT question and detectable answer-key writes. Remove with the legacy columns after a clean production observation window.';

-- The expansion wrapper accepted legacy payloads and canonicalised after its
-- private writer returned. Activation makes the public boundary strict while
-- retaining that implementation as the rollback-compatible storage adapter.
ALTER FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) RENAME TO tutor_ucat_upsert_stem_response_adapter;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_stem_response_adapter(
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
  v_previous_writer_context TEXT;
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
        'single_choice',
        'situational_judgement_rating',
        'decision_making_binary_placement',
        'situational_judgement_most_least'
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

  v_previous_writer_context := current_setting(
    'altitutor.canonical_ucat_writer',
    true
  );
  PERFORM set_config('altitutor.canonical_ucat_writer', 'on', true);
  BEGIN
    v_stem_id := public.tutor_ucat_upsert_stem_response_adapter(
      p_stem_id,
      p_section_id,
      p_question_stem_category_id,
      p_stem_text,
      p_access_scope,
      p_questions,
      p_source_channel,
      p_tutor_source_note
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'altitutor.canonical_ucat_writer',
      coalesce(v_previous_writer_context, 'off'),
      true
    );
    RAISE;
  END;
  PERFORM set_config(
    'altitutor.canonical_ucat_writer',
    coalesce(v_previous_writer_context, 'off'),
    true
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
) TO authenticated;

CREATE FUNCTION public.ucat_canonical_response_snapshot(
  p_question_id UUID,
  p_answer_scheme public.ucat_answer_scheme,
  p_answer_snapshot JSONB,
  p_selected_option_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_answer JSONB;
  v_placements JSONB := '{}'::jsonb;
  v_option_id TEXT;
  v_answer_value BOOLEAN;
BEGIN
  IF p_answer_snapshot IS NULL THEN
    IF p_selected_option_id IS NULL THEN
      RETURN NULL;
    END IF;
    IF p_answer_scheme NOT IN ('single_choice', 'situational_judgement_rating') THEN
      RAISE EXCEPTION 'Selected-option history is incompatible with the UCAT Answer scheme';
    END IF;
    RETURN jsonb_build_object(
      'type', 'ucat_response_v1',
      'questionId', p_question_id,
      'answerScheme', p_answer_scheme,
      'response', jsonb_build_object(
        'kind', 'single_select',
        'selectedOptionId', p_selected_option_id
      )
    );
  END IF;

  IF p_answer_snapshot->>'type' = 'ucat_response_v1' THEN
    RETURN p_answer_snapshot;
  END IF;

  IF p_answer_snapshot->>'type' IS DISTINCT FROM 'syllogism_v1'
    OR p_answer_scheme IS DISTINCT FROM 'decision_making_binary_placement'
    OR jsonb_typeof(p_answer_snapshot->'answers') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Malformed legacy UCAT response snapshot';
  END IF;

  FOR v_answer IN
    SELECT value FROM jsonb_array_elements(p_answer_snapshot->'answers')
  LOOP
    IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_answer->'question_answer_option_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_answer->'answer') IS DISTINCT FROM 'boolean'
    THEN
      RAISE EXCEPTION 'Malformed legacy UCAT response snapshot';
    END IF;
    v_option_id := v_answer->>'question_answer_option_id';
    IF v_placements ? v_option_id THEN
      RAISE EXCEPTION 'Malformed legacy UCAT response snapshot';
    END IF;
    v_answer_value := (v_answer->>'answer')::BOOLEAN;
    v_placements := v_placements || jsonb_build_object(
      v_option_id,
      CASE WHEN v_answer_value THEN 'yes' ELSE 'no' END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'type', 'ucat_response_v1',
    'questionId', p_question_id,
    'answerScheme', p_answer_scheme,
    'response', jsonb_build_object(
      'kind', 'placement',
      'placements', v_placements
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_canonical_response_snapshot(
  UUID, public.ucat_answer_scheme, JSONB, UUID
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.ucat_canonical_content_snapshot(p_snapshot JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_question JSONB;
  v_question_type TEXT;
  v_answer_scheme TEXT;
  v_response_type TEXT;
  v_options JSONB;
BEGIN
  IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_snapshot->'question') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_snapshot->'answerOptions') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Malformed historical UCAT content snapshot';
  END IF;

  v_question := p_snapshot->'question';
  v_question_type := v_question->>'questionType';
  v_answer_scheme := COALESCE(
    NULLIF(v_question->>'answerScheme', ''),
    CASE
      WHEN v_question_type = 'syllogism'
        THEN 'decision_making_binary_placement'
      WHEN p_snapshot#>>'{stem,sectionName}' = 'Situational Judgement'
        THEN 'situational_judgement_rating'
      ELSE 'single_choice'
    END
  );
  v_response_type := COALESCE(
    NULLIF(v_question->>'responseType', ''),
    CASE
      WHEN v_answer_scheme IN (
        'decision_making_binary_placement',
        'situational_judgement_most_least'
      ) THEN 'drag_and_drop'
      ELSE 'multiple_choice'
    END
  );

  SELECT coalesce(jsonb_agg(
    CASE
      WHEN option ? 'answerKeyValue' THEN option
      ELSE option || jsonb_build_object(
        'answerKeyValue',
        CASE
          WHEN v_answer_scheme = 'decision_making_binary_placement'
            AND coalesce((option->>'isAnswer')::BOOLEAN, false) THEN 'yes'
          WHEN v_answer_scheme = 'decision_making_binary_placement' THEN 'no'
          WHEN coalesce((option->>'isAnswer')::BOOLEAN, false) THEN 'correct'
          ELSE NULL
        END
      )
    END
    ORDER BY ordinal
  ), '[]'::jsonb)
  INTO v_options
  FROM jsonb_array_elements(p_snapshot->'answerOptions') WITH ORDINALITY AS item(option, ordinal);

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(
        p_snapshot,
        '{question,responseType}',
        to_jsonb(v_response_type),
        true
      ),
      '{question,answerScheme}',
      to_jsonb(v_answer_scheme),
      true
    ),
    '{answerOptions}',
    v_options,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_canonical_content_snapshot(JSONB)
  FROM PUBLIC, anon, authenticated;

-- Re-run deterministic row backfills to cover writes made during expansion,
-- including soft-deleted questions and answer options.
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
WHERE stem.id = question.question_stem_id
  AND (question.response_type IS NULL OR question.answer_scheme IS NULL);

UPDATE public.question_answer_options option
SET answer_key_value = CASE
  WHEN question.answer_scheme = 'decision_making_binary_placement'
    AND option.is_answer THEN 'yes'::public.ucat_answer_key_value
  WHEN question.answer_scheme = 'decision_making_binary_placement'
    THEN 'no'::public.ucat_answer_key_value
  WHEN option.is_answer THEN 'correct'::public.ucat_answer_key_value
  ELSE NULL
END
FROM public.ucat_questions question
WHERE question.id = option.question_id
  AND question.answer_scheme <> 'situational_judgement_most_least'
  AND option.answer_key_value IS DISTINCT FROM CASE
    WHEN question.answer_scheme = 'decision_making_binary_placement'
      AND option.is_answer THEN 'yes'::public.ucat_answer_key_value
    WHEN question.answer_scheme = 'decision_making_binary_placement'
      THEN 'no'::public.ucat_answer_key_value
    WHEN option.is_answer THEN 'correct'::public.ucat_answer_key_value
    ELSE NULL
  END;

UPDATE public.student_question_attempts attempt
SET answer_snapshot = public.ucat_canonical_response_snapshot(
  COALESCE(attempt.question_id, (attempt.content_snapshot#>>'{question,id}')::UUID),
  COALESCE(
    (
      SELECT question.answer_scheme
      FROM public.ucat_questions question
      WHERE question.id = attempt.question_id
    ),
    NULLIF(attempt.content_snapshot#>>'{question,answerScheme}', '')::public.ucat_answer_scheme,
    CASE
      WHEN attempt.content_snapshot#>>'{question,questionType}' = 'syllogism'
        THEN 'decision_making_binary_placement'::public.ucat_answer_scheme
      WHEN attempt.content_snapshot#>>'{stem,sectionName}' = 'Situational Judgement'
        THEN 'situational_judgement_rating'::public.ucat_answer_scheme
      ELSE 'single_choice'::public.ucat_answer_scheme
    END
  ),
  attempt.answer_snapshot,
  attempt.question_answer_option_id
)
WHERE (
    attempt.answer_snapshot IS NOT NULL
    OR attempt.question_answer_option_id IS NOT NULL
  )
  AND attempt.answer_snapshot->>'type' IS DISTINCT FROM 'ucat_response_v1';

-- The immutability trigger correctly protects application updates. Temporarily
-- remove it while the migration upgrades the historical snapshot itself.
DROP TRIGGER capture_ucat_question_attempt_content
  ON public.student_question_attempts;

UPDATE public.student_question_attempts
SET content_snapshot = public.ucat_canonical_content_snapshot(content_snapshot)
WHERE content_snapshot IS NOT NULL
  AND (
    NOT (content_snapshot->'question' ? 'responseType')
    OR NOT (content_snapshot->'question' ? 'answerScheme')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(content_snapshot->'answerOptions') option
      WHERE NOT (option ? 'answerKeyValue')
    )
  );

CREATE TRIGGER capture_ucat_question_attempt_content
  BEFORE INSERT OR UPDATE OF content_snapshot, question_id
  ON public.student_question_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_ucat_question_attempt_content();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ucat_questions
    WHERE response_type IS NULL OR answer_scheme IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot activate nullable UCAT response contracts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_question_attempts
    WHERE answer_snapshot IS NOT NULL
      AND answer_snapshot->>'type' IS DISTINCT FROM 'ucat_response_v1'
  ) THEN
    RAISE EXCEPTION 'Cannot activate with unconverted UCAT response snapshots';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_question_attempts
    WHERE content_snapshot IS NULL
      OR NOT (content_snapshot->'question' ? 'responseType')
      OR NOT (content_snapshot->'question' ? 'answerScheme')
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(content_snapshot->'answerOptions') option
        WHERE NOT (option ? 'answerKeyValue')
      )
  ) THEN
    RAISE EXCEPTION 'Cannot activate with unconverted UCAT content snapshots';
  END IF;
END;
$$;

ALTER TABLE public.ucat_questions
  ALTER COLUMN response_type SET NOT NULL,
  ALTER COLUMN answer_scheme SET NOT NULL;

COMMENT ON COLUMN public.ucat_questions.response_type IS
  'Required candidate-facing interaction. Legacy question_type remains only as a temporary rollback mirror.';
COMMENT ON COLUMN public.ucat_questions.answer_scheme IS
  'Required response contract controlling validation, persistence, scoring, and review.';

-- Observe compatibility fallbacks after the activation backfill. The answer
-- option trigger can identify every legacy update and legacy inserts that
-- carry a positive/placement key. A null single-choice distractor is identical
-- in PostgreSQL whether the nullable canonical key was supplied or omitted;
-- public writer payload checks remain the evidence for that one case.
CREATE OR REPLACE FUNCTION public.sync_ucat_question_response_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_section_name TEXT;
  v_canonical_changed BOOLEAN;
  v_legacy_changed BOOLEAN;
BEGIN
  IF (NEW.response_type IS NULL) <> (NEW.answer_scheme IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'response_type and answer_scheme must be supplied together';
  END IF;

  v_canonical_changed := (
    TG_OP = 'INSERT' AND NEW.response_type IS NOT NULL
  ) OR (
    TG_OP = 'UPDATE' AND (
      NEW.response_type IS DISTINCT FROM OLD.response_type
      OR NEW.answer_scheme IS DISTINCT FROM OLD.answer_scheme
    )
  );
  v_legacy_changed := (
    TG_OP = 'INSERT' AND NEW.response_type IS NULL
  ) OR (
    TG_OP = 'UPDATE'
    AND NEW.question_type IS DISTINCT FROM OLD.question_type
    AND NOT v_canonical_changed
  );

  IF v_legacy_changed
    AND current_setting('altitutor.canonical_ucat_writer', true) IS DISTINCT FROM 'on'
  THEN
    INSERT INTO public.ucat_response_contract_legacy_write_observations (
      relation_name, operation, record_id, actor_id
    ) VALUES ('ucat_questions', TG_OP, NEW.id, (SELECT auth.uid()));
  END IF;

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

CREATE OR REPLACE FUNCTION public.sync_ucat_answer_option_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_answer_scheme public.ucat_answer_scheme;
  v_canonical_changed BOOLEAN;
  v_legacy_changed BOOLEAN;
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
  v_legacy_changed := (
    TG_OP = 'INSERT'
    AND NEW.answer_key_value IS NULL
    AND (v_answer_scheme = 'decision_making_binary_placement' OR NEW.is_answer)
  ) OR (
    TG_OP = 'UPDATE'
    AND NEW.is_answer IS DISTINCT FROM OLD.is_answer
    AND NOT v_canonical_changed
  );

  IF v_legacy_changed
    AND current_setting('altitutor.canonical_ucat_writer', true) IS DISTINCT FROM 'on'
  THEN
    INSERT INTO public.ucat_response_contract_legacy_write_observations (
      relation_name, operation, record_id, actor_id
    ) VALUES ('question_answer_options', TG_OP, NEW.id, (SELECT auth.uid()));
  END IF;

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
      WHEN v_answer_scheme = 'decision_making_binary_placement'
        THEN 'no'::public.ucat_answer_key_value
      WHEN NEW.is_answer THEN 'correct'::public.ucat_answer_key_value
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.ucat_response_contract_activation_report(
  p_observation_started_at TIMESTAMPTZ DEFAULT '-infinity'::TIMESTAMPTZ
)
RETURNS TABLE(check_name TEXT, issue_count BIGINT, sample_ids UUID[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'missing_question_contracts', count(*),
    (array_agg(question.id ORDER BY question.id))[1:20]
  FROM public.ucat_questions question
  WHERE question.response_type IS NULL OR question.answer_scheme IS NULL

  UNION ALL
  SELECT 'response_type_scheme_mismatches', count(*),
    (array_agg(question.id ORDER BY question.id))[1:20]
  FROM public.ucat_questions question
  WHERE NOT (
    (question.response_type = 'multiple_choice' AND question.answer_scheme IN (
      'single_choice', 'situational_judgement_rating'
    )) OR
    (question.response_type = 'drag_and_drop' AND question.answer_scheme IN (
      'decision_making_binary_placement', 'situational_judgement_most_least'
    ))
  )

  UNION ALL
  SELECT 'invalid_answer_keys', count(*),
    (array_agg(question.id ORDER BY question.id))[1:20]
  FROM public.ucat_questions question
  WHERE EXISTS (
    SELECT 1
    FROM public.question_answer_options option
    WHERE option.question_id = question.id
      AND CASE question.answer_scheme
        WHEN 'decision_making_binary_placement' THEN
          option.answer_key_value IS DISTINCT FROM CASE
            WHEN option.is_answer THEN 'yes'::public.ucat_answer_key_value
            ELSE 'no'::public.ucat_answer_key_value
          END
        WHEN 'single_choice' THEN
          option.answer_key_value IS DISTINCT FROM CASE
            WHEN option.is_answer THEN 'correct'::public.ucat_answer_key_value
            ELSE NULL
          END
        WHEN 'situational_judgement_rating' THEN
          option.answer_key_value IS DISTINCT FROM CASE
            WHEN option.is_answer THEN 'correct'::public.ucat_answer_key_value
            ELSE NULL
          END
        WHEN 'situational_judgement_most_least' THEN
          option.answer_key_value IS NOT NULL
          AND option.answer_key_value NOT IN ('most', 'least')
        ELSE TRUE
      END
  ) OR (
    question.answer_scheme = 'situational_judgement_most_least'
    AND (
      SELECT count(*) <> 3
        OR count(*) FILTER (WHERE option.answer_key_value IS NOT NULL) <> 2
        OR count(*) FILTER (WHERE option.answer_key_value = 'most') <> 1
        OR count(*) FILTER (WHERE option.answer_key_value = 'least') <> 1
      FROM public.question_answer_options option
      WHERE option.question_id = question.id
        AND option.deleted_at IS NULL
    )
  )

  UNION ALL
  SELECT 'legacy_answer_snapshots', count(*),
    (array_agg(attempt.id ORDER BY attempt.id))[1:20]
  FROM public.student_question_attempts attempt
  WHERE attempt.answer_snapshot IS NOT NULL
    AND attempt.answer_snapshot->>'type' IS DISTINCT FROM 'ucat_response_v1'

  UNION ALL
  SELECT 'missing_content_snapshot_contracts', count(*),
    (array_agg(attempt.id ORDER BY attempt.id))[1:20]
  FROM public.student_question_attempts attempt
  WHERE attempt.content_snapshot IS NULL
    OR NOT (attempt.content_snapshot->'question' ? 'responseType')
    OR NOT (attempt.content_snapshot->'question' ? 'answerScheme')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(attempt.content_snapshot->'answerOptions') option
      WHERE NOT (option ? 'answerKeyValue')
    )

  UNION ALL
  SELECT 'unresolved_published_classifications', count(*),
    (array_agg(stem.id ORDER BY stem.id))[1:20]
  FROM public.question_stems stem
  WHERE stem.status = 'published'
    AND stem.deleted_at IS NULL
    AND stem.question_stem_category_id IS NULL

  UNION ALL
  SELECT 'legacy_question_writes_since_observation', count(*),
    (array_agg(observation.record_id ORDER BY observation.occurred_at))[1:20]
  FROM public.ucat_response_contract_legacy_write_observations observation
  WHERE observation.relation_name = 'ucat_questions'
    AND observation.occurred_at >= p_observation_started_at

  UNION ALL
  SELECT 'legacy_answer_key_writes_since_observation', count(*),
    (array_agg(observation.record_id ORDER BY observation.occurred_at))[1:20]
  FROM public.ucat_response_contract_legacy_write_observations observation
  WHERE observation.relation_name = 'question_answer_options'
    AND observation.occurred_at >= p_observation_started_at;
$$;

REVOKE ALL ON FUNCTION public.ucat_response_contract_activation_report(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.ucat_response_contract_activation_report(TIMESTAMPTZ) IS
  'Read-only activation/contraction evidence. Run as a database owner after deployment and after the compatibility observation window.';
