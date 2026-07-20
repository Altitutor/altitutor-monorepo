CREATE TABLE public.student_ucat_content_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (
    target_type IN (
      'answer_explanation',
      'question_insight',
      'attempt_insight',
      'progress_insight',
      'dashboard_insight'
    )
  ),
  target_key text NOT NULL CHECK (char_length(target_key) BETWEEN 1 AND 160),
  target_version text NOT NULL CHECK (char_length(target_version) BETWEEN 1 AND 40),
  context_key text NOT NULL CHECK (char_length(context_key) BETWEEN 1 AND 240),
  surface text NOT NULL CHECK (
    surface IN ('dashboard', 'progress', 'attempt')
  ),
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  reason_code text CHECK (
    reason_code IS NULL OR reason_code IN (
      'inaccurate',
      'unclear',
      'not_relevant',
      'too_generic',
      'timing_advice_wrong',
      'skips_steps',
      'too_long',
      'other'
    )
  ),
  reason_text text CHECK (
    reason_text IS NULL OR char_length(reason_text) BETWEEN 1 AND 1000
  ),
  displayed_content jsonb NOT NULL CHECK (
    jsonb_typeof(displayed_content) = 'object'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_ucat_content_ratings_unique_occurrence
    UNIQUE (student_id, target_type, target_key, target_version, context_key),
  CONSTRAINT student_ucat_content_ratings_upvote_has_no_reason
    CHECK (vote = -1 OR (reason_code IS NULL AND reason_text IS NULL))
);

CREATE INDEX student_ucat_content_ratings_target_idx
  ON public.student_ucat_content_ratings
    (target_type, target_key, target_version, vote);

CREATE INDEX student_ucat_content_ratings_updated_at_idx
  ON public.student_ucat_content_ratings (updated_at DESC);

CREATE TRIGGER set_updated_at_student_ucat_content_ratings
BEFORE UPDATE ON public.student_ucat_content_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.student_ucat_content_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read their own UCAT content ratings"
  ON public.student_ucat_content_ratings
  FOR SELECT
  TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

CREATE POLICY "Students can create their own UCAT content ratings"
  ON public.student_ucat_content_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = (SELECT public.current_student_id()));

CREATE POLICY "Students can update their own UCAT content ratings"
  ON public.student_ucat_content_ratings
  FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT public.current_student_id()))
  WITH CHECK (student_id = (SELECT public.current_student_id()));

CREATE POLICY "Students can delete their own UCAT content ratings"
  ON public.student_ucat_content_ratings
  FOR DELETE
  TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

REVOKE ALL ON TABLE public.student_ucat_content_ratings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.student_ucat_content_ratings
  TO authenticated;
GRANT ALL ON TABLE public.student_ucat_content_ratings TO service_role;

COMMENT ON TABLE public.student_ucat_content_ratings IS
  'Student thumbs ratings for displayed UCAT insights and answer explanations.';
COMMENT ON COLUMN public.student_ucat_content_ratings.displayed_content IS
  'Immutable-at-submission snapshot of the title/body or explanation the student rated.';
