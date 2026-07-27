-- "Request AI review" inserts trigger_kind = manual_request, but the original
-- CHECK only allowed review_submission / content_change / retry. That made
-- every manual request fail with a constraint violation (API 409) after the
-- cycle row had already been created.

ALTER TABLE public.ucat_ai_question_assessment_runs
  DROP CONSTRAINT IF EXISTS ucat_ai_question_assessment_runs_trigger_kind_check;

ALTER TABLE public.ucat_ai_question_assessment_runs
  ADD CONSTRAINT ucat_ai_question_assessment_runs_trigger_kind_check
  CHECK (trigger_kind = ANY (ARRAY[
    'review_submission'::text,
    'content_change'::text,
    'manual_request'::text,
    'retry'::text
  ]));
