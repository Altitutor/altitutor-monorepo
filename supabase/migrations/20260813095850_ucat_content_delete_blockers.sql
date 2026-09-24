-- Explain UCAT soft-delete failures with the concrete set, mock, lesson, or
-- session that still references the content, matching tutor-web lifecycle toasts.

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_delete_blockers(
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
  v_blockers JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_set',
      'message', format(
        'This question is used by the %s set “%s”. Remove it from that set before deleting.',
        replace(parent.status::TEXT, '_', ' '),
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
      AND parent.deleted_at IS NULL;

    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This question is attached to session “%s”. Remove it from the session before deleting.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    ) ORDER BY session.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.question_stem_id = p_content_id;

    SELECT v_blockers || COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
      'code', 'learning_module_attachment',
      'message', format(
        'This question is used by lesson “%s”. Remove the linked block before deleting.',
        COALESCE(module.title, 'Untitled learning module')
      ),
      'entity_type', 'learning_module',
      'entity_id', module.id,
      'entity_name', COALESCE(module.title, 'Untitled learning module')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_learning_module_blocks block
    JOIN public.ucat_learning_modules module ON module.id = block.learning_module_id
    LEFT JOIN public.ucat_questions question ON question.id = block.question_id
    WHERE block.deleted_at IS NULL
      AND module.deleted_at IS NULL
      AND (block.question_stem_id = p_content_id OR question.question_stem_id = p_content_id);

  ELSIF p_content_type = 'set' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_mock',
      'message', format(
        'This set is used by the %s mock “%s”. Remove it from that mock before deleting.',
        replace(parent.status::TEXT, '_', ' '),
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
      AND parent.deleted_at IS NULL;

    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This set is attached to session “%s”. Remove it from the session before deleting.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    ) ORDER BY session.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.question_set_id = p_content_id;

  ELSIF p_content_type = 'mock' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This mock is attached to session “%s”. Remove it from the session before deleting.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    ) ORDER BY session.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.ucat_mock_id = p_content_id;

  ELSIF p_content_type = 'lesson' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This lesson is attached to session “%s”. Remove it from the session before deleting.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    ) ORDER BY session.id), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.ucat_learning_module_id = p_content_id;

  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  RETURN v_blockers;
END;
$$;

COMMENT ON FUNCTION public.tutor_ucat_content_delete_blockers(TEXT, UUID) IS
  'Returns structured delete blockers for a UCAT stem, set, mock, or lesson.';

REVOKE ALL ON FUNCTION public.tutor_ucat_content_delete_blockers(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_content_delete_blockers(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_stems(p_stem_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(array_length(p_stem_ids, 1), 0) = 0 THEN RETURN; END IF;
  FOREACH v_stem_id IN ARRAY p_stem_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_delete_question_stem(v_stem_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_delete_item:%:%', v_stem_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_sets(p_set_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(array_length(p_set_ids, 1), 0) = 0 THEN RETURN; END IF;
  FOREACH v_set_id IN ARRAY p_set_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_delete_question_set(v_set_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_delete_item:%:%', v_set_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_mocks(p_mock_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(array_length(p_mock_ids, 1), 0) = 0 THEN RETURN; END IF;
  FOREACH v_mock_id IN ARRAY p_mock_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_delete_mock(v_mock_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_delete_item:%:%', v_mock_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_learning_modules(p_module_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_module_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(array_length(p_module_ids, 1), 0) = 0 THEN RETURN; END IF;
  FOREACH v_module_id IN ARRAY p_module_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_soft_delete_learning_module(v_module_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_delete_item:%:%', v_module_id, SQLERRM;
    END;
  END LOOP;
END;
$$;
