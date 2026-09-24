ALTER TABLE public.student_ucat_content_ratings
  ADD COLUMN question_id uuid REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution_reason text;

-- Keep base-table access admin-only even if the original migration was applied
-- before the student API-route access model was adopted.
DROP POLICY IF EXISTS "Students can read their own UCAT content ratings"
  ON public.student_ucat_content_ratings;
DROP POLICY IF EXISTS "Students can create their own UCAT content ratings"
  ON public.student_ucat_content_ratings;
DROP POLICY IF EXISTS "Students can update their own UCAT content ratings"
  ON public.student_ucat_content_ratings;
DROP POLICY IF EXISTS "Students can delete their own UCAT content ratings"
  ON public.student_ucat_content_ratings;
DROP POLICY IF EXISTS "ADMINSTAFF full access to student UCAT content ratings"
  ON public.student_ucat_content_ratings;

CREATE POLICY "ADMINSTAFF full access to student UCAT content ratings"
  ON public.student_ucat_content_ratings
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

REVOKE ALL ON TABLE public.student_ucat_content_ratings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.student_ucat_content_ratings
  TO authenticated;
GRANT ALL ON TABLE public.student_ucat_content_ratings TO service_role;

ALTER TABLE public.student_ucat_content_ratings
  ADD CONSTRAINT student_ucat_content_ratings_resolution_reason_check
    CHECK (resolution_reason IS NULL OR resolution_reason IN ('content_revised', 'manual_review')),
  ADD CONSTRAINT student_ucat_content_ratings_explanation_has_question
    CHECK (target_type <> 'answer_explanation' OR question_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT student_ucat_content_ratings_resolution_is_complete
    CHECK (
      (resolved_at IS NULL AND resolution_reason IS NULL)
      OR (resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)
    );

-- Existing explanation ratings predate the relational question_id. Backfill the
-- UUID encoded by the original question:<uuid> target key before validating.
UPDATE public.student_ucat_content_ratings
SET question_id = substring(
  target_key FROM '^question:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$'
)::uuid
WHERE target_type = 'answer_explanation'
  AND target_key ~ '^question:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

ALTER TABLE public.student_ucat_content_ratings
  VALIDATE CONSTRAINT student_ucat_content_ratings_explanation_has_question;

CREATE INDEX student_ucat_content_ratings_open_explanation_idx
  ON public.student_ucat_content_ratings (question_id, vote, updated_at DESC)
  WHERE target_type = 'answer_explanation' AND resolved_at IS NULL;

CREATE INDEX student_ucat_content_ratings_open_insight_idx
  ON public.student_ucat_content_ratings (target_type, target_key, target_version, updated_at DESC)
  WHERE target_type <> 'answer_explanation' AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_ucat_answer_explanation_ratings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_question_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'ucat_questions' THEN
    v_question_id := NEW.id;
  ELSE
    v_question_id := NEW.question_id;
  END IF;

  UPDATE public.student_ucat_content_ratings
  SET resolved_at = now(),
      resolution_reason = 'content_revised'
  WHERE target_type = 'answer_explanation'
    AND question_id = v_question_id
    AND resolved_at IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ucat_answer_explanation_ratings() FROM PUBLIC;

CREATE TRIGGER resolve_ratings_after_question_explanation_change
AFTER UPDATE OF answer_explanation ON public.ucat_questions
FOR EACH ROW
WHEN (OLD.answer_explanation IS DISTINCT FROM NEW.answer_explanation)
EXECUTE FUNCTION public.resolve_ucat_answer_explanation_ratings();

CREATE TRIGGER resolve_ratings_after_option_explanation_change
AFTER UPDATE OF answer_explanation, deleted_at ON public.question_answer_options
FOR EACH ROW
WHEN (
  OLD.answer_explanation IS DISTINCT FROM NEW.answer_explanation
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_answer_explanation_ratings();

CREATE TRIGGER resolve_ratings_after_option_explanation_insert
AFTER INSERT ON public.question_answer_options
FOR EACH ROW
WHEN (NEW.answer_explanation IS NOT NULL)
EXECUTE FUNCTION public.resolve_ucat_answer_explanation_ratings();

COMMENT ON COLUMN public.student_ucat_content_ratings.resolved_at IS
  'When this feedback stopped applying to the current content. Resolved rows remain available for audit.';
