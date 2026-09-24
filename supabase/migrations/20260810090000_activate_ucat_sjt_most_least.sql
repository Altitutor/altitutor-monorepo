-- Activate SJT Most/Least publication now that authoring, student response,
-- persistence, scoring, results, and review consumers share the canonical
-- response contract.

ALTER FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  RENAME TO ucat_content_publication_pre_most_least_issues;

REVOKE ALL ON FUNCTION public.ucat_content_publication_pre_most_least_issues(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_content_publication_pre_most_least_issues(TEXT, UUID) FROM authenticated;

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
  v_question_count BIGINT;
  v_most_least_count BIGINT;
  v_rating_count BIGINT;
BEGIN
  SELECT COALESCE(jsonb_agg(issue), '[]'::jsonb)
  INTO v_issues
  FROM jsonb_array_elements(
    public.ucat_content_publication_pre_most_least_issues(
      p_content_type,
      p_content_id
    )
  ) issue
  WHERE issue->>'code' <> 'sj_most_least_not_activated';

  IF p_content_type <> 'stem' THEN
    RETURN v_issues;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (
      WHERE question.answer_scheme = 'situational_judgement_most_least'
    ),
    count(*) FILTER (
      WHERE question.answer_scheme = 'situational_judgement_rating'
    )
  INTO v_question_count, v_most_least_count, v_rating_count
  FROM public.ucat_questions question
  WHERE question.question_stem_id = p_content_id
    AND question.deleted_at IS NULL;

  IF v_most_least_count > 0 AND v_question_count <> 1 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'sj_most_least_question_count',
      'message', 'A Most/Least Appropriate stem must contain exactly one question.'
    ));
  ELSIF v_rating_count = v_question_count AND v_rating_count > 6 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'sj_rating_question_count',
      'message', 'An SJT rating stem may contain at most six questions.'
    ));
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) IS
  'Returns publication blockers, including active response-contract and SJT stem-cardinality gates.';
