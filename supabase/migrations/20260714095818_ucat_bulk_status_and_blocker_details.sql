-- Bulk lifecycle transitions are atomic, and expected transition failures can
-- be explained with the concrete parent/session/module that blocks the move.

DROP FUNCTION IF EXISTS public.tutor_ucat_remove_stems_from_all_sets(UUID[]);
DROP FUNCTION IF EXISTS public.tutor_ucat_remove_sets_from_all_mocks(UUID[]);

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
    PERFORM public.tutor_ucat_delete_question_stem(v_stem_id);
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
    PERFORM public.tutor_ucat_delete_question_set(v_set_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_delete_question_stems(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_delete_question_sets(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_question_stems(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_question_sets(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_status_bulk(
  p_content_type TEXT,
  p_content_ids UUID[],
  p_status public.ucat_content_status
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_content_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(array_length(p_content_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_item';
  END IF;

  FOREACH v_content_id IN ARRAY p_content_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, p_status);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_status_item:%:%', v_content_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_content_status_bulk(TEXT, UUID[], public.ucat_content_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_status_bulk(TEXT, UUID[], public.ucat_content_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_status_blockers(
  p_content_type TEXT,
  p_content_id UUID,
  p_status public.ucat_content_status
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

  IF p_status = 'published' THEN
    SELECT COALESCE(jsonb_agg(issue), '[]'::jsonb)
    INTO v_blockers
    FROM jsonb_array_elements(public.ucat_content_publication_issues(p_content_type, p_content_id)) issue;
    RETURN v_blockers;
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_set',
      'message', format(
        'This question is used by the %s set “%s”. Move or edit that set first.',
        replace(parent.status::TEXT, '_', ' '),
        COALESCE(NULLIF(public.extract_text_from_prosemirror_json(parent.name), ''), 'Untitled set')
      ),
      'entity_type', 'set',
      'entity_id', parent.id,
      'entity_name', COALESCE(NULLIF(public.extract_text_from_prosemirror_json(parent.name), ''), 'Untitled set')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_stems_question_sets member
    JOIN public.question_sets parent ON parent.id = member.question_set_id
    WHERE member.question_stem_id = p_content_id
      AND parent.deleted_at IS NULL
      AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'));

    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This question is attached to session “%s”. Remove it from the session before moving it out of Published.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.question_stem_id = p_content_id;

    SELECT v_blockers || COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
      'code', 'learning_module_attachment',
      'message', format(
        'This question is used by learning module “%s”. Remove the linked block before moving it out of Published.',
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
        'This set is used by the %s mock “%s”. Move or edit that mock first.',
        replace(parent.status::TEXT, '_', ' '),
        COALESCE(parent.name, 'Untitled mock')
      ),
      'entity_type', 'mock',
      'entity_id', parent.id,
      'entity_name', COALESCE(parent.name, 'Untitled mock')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.question_sets_ucat_mocks member
    JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
    WHERE member.question_set_id = p_content_id
      AND parent.deleted_at IS NULL
      AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'));

    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This set is attached to session “%s”. Remove it from the session before moving it out of Published.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.question_set_id = p_content_id;

    IF p_status = 'in_review' THEN
      SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
        'code', 'draft_child_stem',
        'message', 'This set contains a draft question. Send that question for review first.',
        'entity_type', 'stem',
        'entity_id', child.id,
        'entity_name', 'Draft question'
      )), '[]'::jsonb)
      INTO v_blockers
      FROM public.question_stems_question_sets member
      JOIN public.question_stems child ON child.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (child.deleted_at IS NOT NULL OR child.status = 'draft');
    END IF;

  ELSIF p_content_type = 'mock' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This mock is attached to session “%s”. Remove it from the session before moving it out of Published.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    )), '[]'::jsonb)
    INTO v_blockers
    FROM public.ucat_sessions_resources resource
    JOIN public.sessions session ON session.id = resource.session_id
    WHERE resource.ucat_mock_id = p_content_id;

    IF p_status = 'in_review' THEN
      SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
        'code', 'draft_child_set',
        'message', format(
          'This mock contains the draft set “%s”. Send that set for review first.',
          COALESCE(NULLIF(public.extract_text_from_prosemirror_json(child.name), ''), 'Untitled set')
        ),
        'entity_type', 'set',
        'entity_id', child.id,
        'entity_name', COALESCE(NULLIF(public.extract_text_from_prosemirror_json(child.name), ''), 'Untitled set')
      )), '[]'::jsonb)
      INTO v_blockers
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets child ON child.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND (child.deleted_at IS NOT NULL OR child.status = 'draft');
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  RETURN v_blockers;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_content_status_blockers(TEXT, UUID, public.ucat_content_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_content_status_blockers(TEXT, UUID, public.ucat_content_status) TO authenticated;
