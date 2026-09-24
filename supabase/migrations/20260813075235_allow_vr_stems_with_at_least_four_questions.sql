-- Verbal Reasoning publication previously required exactly four questions.
-- Official VR items are typically four, but authoring may attach more than
-- four questions to one stem. Keep a floor of four.

CREATE OR REPLACE FUNCTION public.ucat_content_response_foundation_issues(
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
  v_section_name TEXT;
  v_question_count BIGINT;
BEGIN
  v_issues := public.ucat_content_publication_base_issues(
    p_content_type,
    p_content_id
  );

  IF p_content_type <> 'stem' THEN
    RETURN v_issues;
  END IF;

  SELECT lower(trim(section.name)), count(question.id)
  INTO v_section_name, v_question_count
  FROM public.question_stems stem
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.ucat_questions question
    ON question.question_stem_id = stem.id
    AND question.deleted_at IS NULL
  WHERE stem.id = p_content_id
    AND stem.deleted_at IS NULL
  GROUP BY section.name;

  IF v_section_name = 'verbal reasoning' AND v_question_count < 4 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'vr_question_count',
      'message', 'Verbal Reasoning stems must contain at least four questions.'
    ));
  ELSIF v_section_name = 'decision making' AND v_question_count <> 1 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'dm_question_count',
      'message', 'Decision Making stems must contain exactly one question.'
    ));
  END IF;

  RETURN v_issues;
END;
$$;

COMMENT ON FUNCTION public.ucat_content_response_foundation_issues(TEXT, UUID) IS
  'Returns publication blockers, including VR at-least-four and DM exactly-one question-count gates.';
