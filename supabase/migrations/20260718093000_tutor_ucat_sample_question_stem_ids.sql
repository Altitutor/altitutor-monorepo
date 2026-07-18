-- Sample published UCAT question stem IDs uniformly for AI generation source examples.
-- Avoids PostgREST max_rows (1000) when loading the full eligible ID set in app code.

CREATE OR REPLACE FUNCTION public.tutor_ucat_sample_question_stem_ids(
  p_section_id UUID,
  p_limit INTEGER DEFAULT 300,
  p_category_id UUID DEFAULT NULL,
  p_include_ai_source_stems BOOLEAN DEFAULT FALSE
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_ids UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_section_id IS NULL THEN
    RAISE EXCEPTION 'section_id_required';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 300), 1), 500);

  SELECT COALESCE(array_agg(sampled.id), ARRAY[]::UUID[])
  INTO v_ids
  FROM (
    SELECT qs.id
    FROM public.question_stems qs
    WHERE qs.section_id = p_section_id
      AND qs.deleted_at IS NULL
      AND qs.status = 'published'
      AND (p_category_id IS NULL OR qs.question_stem_category_id = p_category_id)
      AND (
        p_include_ai_source_stems
        OR qs.source_channel IS DISTINCT FROM 'ai_generation'::public.ucat_question_source_channel
      )
    ORDER BY random()
    LIMIT v_limit
  ) sampled;

  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION public.tutor_ucat_sample_question_stem_ids(UUID, INTEGER, UUID, BOOLEAN) IS
  'Returns a uniform random sample of published question stem IDs for UCAT AI generation source examples.';

REVOKE ALL ON FUNCTION public.tutor_ucat_sample_question_stem_ids(UUID, INTEGER, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_sample_question_stem_ids(UUID, INTEGER, UUID, BOOLEAN) TO authenticated;
