-- Migration: UCAT bulk question stem import RPC
-- Description: Add tutor_ucat_bulk_upsert_question_stem_bundles to insert many question stems,
--              questions, and answer options in a single transactional RPC for tutor-web bulk import.
-- Author: AI assistant
-- Date: 2026-02-25

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(
  p_section_id UUID,
  p_stems JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_ids UUID[] := ARRAY[]::UUID[];
  v_stem JSONB;
  v_stem_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN
    RAISE EXCEPTION 'invalid_stems_payload';
  END IF;

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      COALESCE(NULLIF(v_stem->>'stemId', '')::UUID, NULL),
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      COALESCE((v_stem->>'isPrivate')::BOOLEAN, false),
      COALESCE(v_stem->'questions', '[]'::jsonb)
    );

    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;

  RETURN v_result_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) TO authenticated;

