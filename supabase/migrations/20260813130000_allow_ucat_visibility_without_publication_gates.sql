-- Access scope is independent of publication readiness. Bulk visibility (and
-- category) updates were re-running every publication issue on already-published
-- stems, so a VR stem with fewer than four questions could not be made private
-- or public. Keep those checks on publish and on content saves.

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_update_stem_metadata_before_blueprint_guard(
  p_stem_ids UUID[],
  p_question_stem_category_id UUID,
  p_access_scope public.ucat_access_scope
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  FOREACH v_stem_id IN ARRAY COALESCE(p_stem_ids, ARRAY[]::UUID[])
  LOOP
    IF p_question_stem_category_id IS NOT NULL THEN
      UPDATE public.question_stems
      SET question_stem_category_id = p_question_stem_category_id, updated_by = v_staff_id
      WHERE id = v_stem_id AND deleted_at IS NULL;
    END IF;
    IF p_access_scope IS NOT NULL THEN
      PERFORM public.tutor_ucat_set_content_access('stem', v_stem_id, p_access_scope);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_update_stem_metadata_before_blueprint_guard(
  UUID[], UUID, public.ucat_access_scope
) FROM PUBLIC, anon, authenticated;
