-- Explain UCAT visibility failures with the concrete public parent or private
-- child that blocks the change, matching tutor-web lifecycle toasts.

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_visibility_blockers(
  p_content_type TEXT,
  p_content_id UUID,
  p_access_scope public.ucat_access_scope,
  p_member_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'stem' AND p_access_scope = 'private' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'private_child_of_public_set',
      'message', format(
        'Cannot make this question private while it belongs to the public set “%s”. Remove it from that set or make the set private first.',
        COALESCE(NULLIF(public.extract_text_from_prosemirror_json(parent.name), ''), 'Untitled set')
      ),
      'entity_type', 'set',
      'entity_id', parent.id,
      'entity_name', COALESCE(NULLIF(public.extract_text_from_prosemirror_json(parent.name), ''), 'Untitled set')
    ) ORDER BY parent.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_stems_question_sets member
    JOIN public.question_sets parent ON parent.id = member.question_set_id
    WHERE member.question_stem_id = p_content_id
      AND parent.deleted_at IS NULL
      AND parent.access_scope = 'public';

  ELSIF p_content_type = 'set' AND p_access_scope = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'public_set_contains_private_stem',
      'message', format(
        'This public set contains the private question “%s”. Make that question public or remove it from the set first.',
        COALESCE(NULLIF(btrim(left(public.extract_text_from_prosemirror_json(child.stem_text), 80)), ''), 'Untitled question')
      ),
      'entity_type', 'stem',
      'entity_id', child.id,
      'entity_name', COALESCE(NULLIF(btrim(left(public.extract_text_from_prosemirror_json(child.stem_text), 80)), ''), 'Untitled question')
    ) ORDER BY child.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_stems child
    WHERE child.deleted_at IS NULL
      AND child.access_scope = 'private'
      AND child.id = ANY(
        COALESCE(
          p_member_ids,
          ARRAY(
            SELECT member.question_stem_id
            FROM public.question_stems_question_sets member
            WHERE member.question_set_id = p_content_id
          )
        )
      );

  ELSIF p_content_type = 'set' AND p_access_scope = 'private' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'private_child_of_public_mock',
      'message', format(
        'Cannot make this set private while it belongs to the public mock “%s”. Remove it from that mock or make the mock private first.',
        COALESCE(parent.name, 'Untitled mock')
      ),
      'entity_type', 'mock',
      'entity_id', parent.id,
      'entity_name', COALESCE(parent.name, 'Untitled mock')
    ) ORDER BY parent.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_sets_ucat_mocks member
    JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
    WHERE member.question_set_id = p_content_id
      AND parent.deleted_at IS NULL
      AND parent.access_scope = 'public';

  ELSIF p_content_type = 'mock' AND p_access_scope = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'public_mock_contains_private_set',
      'message', format(
        'This public mock contains the private set “%s”. Make that set public or remove it from the mock first.',
        COALESCE(NULLIF(public.extract_text_from_prosemirror_json(child.name), ''), 'Untitled set')
      ),
      'entity_type', 'set',
      'entity_id', child.id,
      'entity_name', COALESCE(NULLIF(public.extract_text_from_prosemirror_json(child.name), ''), 'Untitled set')
    ) ORDER BY child.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_sets child
    WHERE child.deleted_at IS NULL
      AND child.access_scope = 'private'
      AND child.id = ANY(
        COALESCE(
          p_member_ids,
          ARRAY(
            SELECT member.question_set_id
            FROM public.question_sets_ucat_mocks member
            WHERE member.ucat_mock_id = p_content_id
          )
        )
      );
  END IF;

  RETURN v_blockers;
END;
$$;

COMMENT ON FUNCTION public.tutor_ucat_content_visibility_blockers(TEXT, UUID, public.ucat_access_scope, UUID[]) IS
  'Returns structured visibility blockers for a UCAT stem, set, or mock.';

REVOKE ALL ON FUNCTION public.tutor_ucat_content_visibility_blockers(TEXT, UUID, public.ucat_access_scope, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_content_visibility_blockers(TEXT, UUID, public.ucat_access_scope, UUID[]) TO authenticated;

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
    BEGIN
      IF p_question_stem_category_id IS NOT NULL THEN
        UPDATE public.question_stems
        SET question_stem_category_id = p_question_stem_category_id, updated_by = v_staff_id
        WHERE id = v_stem_id AND deleted_at IS NULL;
      END IF;
      IF p_access_scope IS NOT NULL THEN
        PERFORM public.tutor_ucat_set_content_access('stem', v_stem_id, p_access_scope);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_update_item:%:%', v_stem_id, SQLERRM;
    END;
  END LOOP;
END;
$$;
