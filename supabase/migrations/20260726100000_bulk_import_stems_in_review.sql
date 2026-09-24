-- Bulk-imported question stems should land in In review (like AI-generated
-- stems), not Draft, so they enter the approval / AI assessment queue.

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
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN RAISE EXCEPTION 'invalid_stems_payload'; END IF;
  v_staff_id := public.current_tutor_id();

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      NULLIF(v_stem->>'stemId', '')::UUID,
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      COALESCE(NULLIF(v_stem->>'accessScope', '')::public.ucat_access_scope, 'public'),
      COALESCE(v_stem->'questions', '[]'::jsonb),
      COALESCE(NULLIF(v_stem->>'sourceChannel', '')::public.ucat_question_source_channel, 'bulk_import'),
      v_stem->>'tutorSourceNote'
    );
    UPDATE public.question_stems
    SET status = 'in_review',
        status_changed_at = NOW(),
        status_changed_by = v_staff_id,
        updated_by = v_staff_id
    WHERE id = v_stem_id;
    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;
  RETURN v_result_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) TO authenticated;
