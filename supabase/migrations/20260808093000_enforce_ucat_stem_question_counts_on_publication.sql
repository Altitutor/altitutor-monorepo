-- Keep the database publication boundary aligned with the deterministic
-- authoring gates. These checks apply to every publication path, including
-- direct RPC and MCP writes.

ALTER FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  RENAME TO ucat_content_publication_base_issues;

REVOKE ALL ON FUNCTION public.ucat_content_publication_base_issues(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_content_publication_base_issues(TEXT, UUID) FROM authenticated;

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

  IF v_section_name = 'verbal reasoning' AND v_question_count <> 4 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'vr_question_count',
      'message', 'Verbal Reasoning stems must contain exactly four questions.'
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

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) IS
  'Returns publication blockers, including deterministic UCAT section question-count gates.';
