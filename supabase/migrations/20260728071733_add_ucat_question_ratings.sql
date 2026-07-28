ALTER TABLE public.student_ucat_content_ratings
  DROP CONSTRAINT IF EXISTS student_ucat_content_ratings_target_type_check,
  DROP CONSTRAINT IF EXISTS student_ucat_content_ratings_reason_code_check,
  DROP CONSTRAINT IF EXISTS student_ucat_content_ratings_explanation_has_question;

ALTER TABLE public.student_ucat_content_ratings
  ADD CONSTRAINT student_ucat_content_ratings_target_type_check CHECK (
    target_type IN (
      'answer_explanation',
      'question',
      'question_insight',
      'attempt_insight',
      'progress_insight',
      'dashboard_insight'
    )
  ),
  ADD CONSTRAINT student_ucat_content_ratings_reason_code_check CHECK (
    reason_code IS NULL OR reason_code IN (
      'inaccurate',
      'unclear',
      'not_relevant',
      'too_generic',
      'timing_advice_wrong',
      'skips_steps',
      'too_long',
      'misformatted',
      'answer_incorrect',
      'too_easy',
      'too_hard',
      'other'
    )
  ),
  ADD CONSTRAINT student_ucat_content_ratings_question_content_has_question CHECK (
    target_type NOT IN ('answer_explanation', 'question')
    OR question_id IS NOT NULL
  );

CREATE INDEX student_ucat_content_ratings_open_question_idx
  ON public.student_ucat_content_ratings
    (question_id, vote, updated_at DESC)
  WHERE target_type = 'question' AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_ucat_question_content_ratings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_question_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_question_id := OLD.question_id;
  ELSIF TG_TABLE_NAME = 'ucat_questions' THEN
    v_question_id := NEW.id;
  ELSE
    v_question_id := NEW.question_id;
  END IF;

  UPDATE public.student_ucat_content_ratings
  SET resolved_at = now(),
      resolution_reason = 'content_revised'
  WHERE target_type = 'question'
    AND question_id = v_question_id
    AND resolved_at IS NULL;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ucat_question_content_ratings() FROM PUBLIC;

CREATE TRIGGER resolve_ratings_after_question_content_change
AFTER UPDATE OF question_text, question_type, deleted_at ON public.ucat_questions
FOR EACH ROW
WHEN (
  OLD.question_text IS DISTINCT FROM NEW.question_text
  OR OLD.question_type IS DISTINCT FROM NEW.question_type
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

CREATE TRIGGER resolve_ratings_after_answer_option_content_change
AFTER UPDATE OF answer_text, index, is_answer, deleted_at
ON public.question_answer_options
FOR EACH ROW
WHEN (
  OLD.answer_text IS DISTINCT FROM NEW.answer_text
  OR OLD.index IS DISTINCT FROM NEW.index
  OR OLD.is_answer IS DISTINCT FROM NEW.is_answer
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

CREATE TRIGGER resolve_ratings_after_answer_option_insert
AFTER INSERT ON public.question_answer_options
FOR EACH ROW
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

CREATE TRIGGER resolve_ratings_after_answer_option_delete
AFTER DELETE ON public.question_answer_options
FOR EACH ROW
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

CREATE OR REPLACE FUNCTION public.resolve_ucat_stem_question_ratings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.student_ucat_content_ratings rating
  SET resolved_at = now(),
      resolution_reason = 'content_revised'
  WHERE rating.target_type = 'question'
    AND rating.resolved_at IS NULL
    AND rating.question_id IN (
      SELECT question.id
      FROM public.ucat_questions question
      WHERE question.question_stem_id = NEW.id
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ucat_stem_question_ratings() FROM PUBLIC;

CREATE TRIGGER resolve_ratings_after_question_stem_content_change
AFTER UPDATE OF stem_text, deleted_at ON public.question_stems
FOR EACH ROW
WHEN (
  OLD.stem_text IS DISTINCT FROM NEW.stem_text
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_stem_question_ratings();

COMMENT ON FUNCTION public.resolve_ucat_question_content_ratings() IS
  'Resolves open student question ratings when the rated question or its answer options change.';
COMMENT ON FUNCTION public.resolve_ucat_stem_question_ratings() IS
  'Resolves open student question ratings when shared stem content changes.';
