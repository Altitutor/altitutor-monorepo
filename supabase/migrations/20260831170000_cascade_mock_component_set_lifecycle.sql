-- Sending a mock for review submits its draft component sets first. Publishing
-- a mock publishes unpublished component sets first. Either cascade is atomic:
-- a child failure rolls back the mock status change.

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_status(
  p_content_type TEXT,
  p_content_id UUID,
  p_status public.ucat_content_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_current public.ucat_content_status;
  v_issues JSONB;
  v_child RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_content_type = 'stem' THEN
    SELECT status INTO v_current FROM public.question_stems WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'set' THEN
    SELECT status INTO v_current FROM public.question_sets WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'mock' THEN
    SELECT status INTO v_current FROM public.ucat_mocks WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'lesson' THEN
    SELECT status INTO v_current FROM public.ucat_learning_modules
    WHERE id = p_content_id AND deleted_at IS NULL AND kind = 'lesson';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
  IF v_current IS NULL THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
  IF v_current = p_status THEN RETURN; END IF;
  IF v_current = 'draft' AND p_status = 'published' THEN
    RAISE EXCEPTION 'send_content_for_review_before_publishing';
  END IF;

  IF p_content_type = 'mock' AND p_status = 'in_review' THEN
    FOR v_child IN
      SELECT child.id
      FROM public.question_sets child
      WHERE child.mock_id = p_content_id
        AND child.deleted_at IS NULL
        AND child.status = 'draft'
      ORDER BY child.created_at, child.id
    LOOP
      PERFORM public.tutor_ucat_set_content_status('set', v_child.id, 'in_review');
    END LOOP;
  ELSIF p_content_type = 'mock' AND p_status = 'published' THEN
    FOR v_child IN
      SELECT child.id, child.status
      FROM public.question_sets child
      WHERE child.mock_id = p_content_id
        AND child.deleted_at IS NULL
        AND child.status IS DISTINCT FROM 'published'
      ORDER BY child.created_at, child.id
    LOOP
      IF v_child.status = 'draft' THEN
        PERFORM public.tutor_ucat_set_content_status('set', v_child.id, 'in_review');
      END IF;
      PERFORM public.tutor_ucat_set_content_status('set', v_child.id, 'published');
    END LOOP;
  END IF;

  IF p_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues(p_content_type, p_content_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'publication_blocked:%', v_issues::TEXT;
    END IF;
  END IF;

  IF p_status <> 'published' THEN
    IF p_content_type = 'stem' AND EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member
      JOIN public.question_sets parent ON parent.id = member.question_set_id
      WHERE member.question_stem_id = p_content_id
        AND parent.deleted_at IS NULL
        AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
    ) THEN RAISE EXCEPTION 'status_blocked_by_parent_set'; END IF;
    IF p_content_type = 'set' AND EXISTS (
      SELECT 1 FROM public.question_sets child
      JOIN public.ucat_mocks parent ON parent.id = child.mock_id
      WHERE child.id = p_content_id AND parent.deleted_at IS NULL
        AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
    ) THEN RAISE EXCEPTION 'status_blocked_by_parent_mock'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.ucat_sessions_resources resource
      WHERE (p_content_type = 'stem' AND resource.question_stem_id = p_content_id)
         OR (p_content_type = 'set' AND resource.question_set_id = p_content_id)
         OR (p_content_type = 'mock' AND resource.ucat_mock_id = p_content_id)
         OR (p_content_type = 'lesson' AND resource.ucat_learning_module_id = p_content_id)
    ) THEN RAISE EXCEPTION 'status_blocked_by_attachment'; END IF;
  END IF;

  IF p_status = 'in_review' AND p_content_type = 'set' AND EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_stems child ON child.id = member.question_stem_id
    WHERE member.question_set_id = p_content_id
      AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
  ) THEN RAISE EXCEPTION 'in_review_set_contains_draft_stem'; END IF;
  IF p_status = 'in_review' AND p_content_type = 'mock' AND EXISTS (
    SELECT 1 FROM public.question_sets child
    WHERE child.mock_id = p_content_id
      AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
  ) THEN RAISE EXCEPTION 'in_review_mock_contains_draft_set'; END IF;

  IF p_content_type = 'stem' THEN
    UPDATE public.question_stems SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSIF p_content_type = 'set' THEN
    UPDATE public.question_sets SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSIF p_content_type = 'mock' THEN
    UPDATE public.ucat_mocks SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSE
    UPDATE public.ucat_learning_modules SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id, updated_at = NOW()
    WHERE id = p_content_id AND kind = 'lesson';
  END IF;
END;
$$;

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
  v_blockers JSONB := '[]'::JSONB;
  v_child_blockers JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status = 'published' THEN
    SELECT COALESCE(jsonb_agg(issue), '[]'::JSONB)
    INTO v_blockers
    FROM jsonb_array_elements(
      public.ucat_content_publication_issues(p_content_type, p_content_id)
    ) issue
    WHERE p_content_type <> 'mock' OR issue->>'code' <> 'unpublished_children';
    IF p_content_type = 'mock' THEN
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'code', issue->>'code',
          'message', format(
            '“%s”: %s',
            public.ucat_question_set_catalog_name(child.id),
            issue->>'message'
          ),
          'entity_type', COALESCE(NULLIF(issue->>'entity_type', ''), 'set'),
          'entity_id', COALESCE(NULLIF(issue->>'entity_id', ''), child.id::TEXT),
          'entity_name', COALESCE(
            NULLIF(issue->>'entity_name', ''),
            public.ucat_question_set_catalog_name(child.id)
          )
        )
        ORDER BY child.created_at, child.id, issue->>'code'
      ), '[]'::JSONB)
      INTO v_child_blockers
      FROM public.question_sets child
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN child.status = 'draft' THEN
            public.tutor_ucat_content_status_blockers('set', child.id, 'in_review')
            || public.ucat_content_publication_issues('set', child.id)
          ELSE public.ucat_content_publication_issues('set', child.id)
        END
      ) issue
      WHERE child.mock_id = p_content_id
        AND child.deleted_at IS NULL
        AND child.status IS DISTINCT FROM 'published';
      v_blockers := COALESCE(v_blockers, '[]'::JSONB) || v_child_blockers;
    END IF;
    RETURN COALESCE(v_blockers, '[]'::JSONB);
  END IF;
  IF p_content_type = 'set' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_mock',
      'message', format('This set belongs to the %s mock “%s”. Move that mock first.',
        replace(parent.status::TEXT, '_', ' '), public.ucat_mock_catalog_name(parent.id)),
      'entity_type', 'mock', 'entity_id', parent.id,
      'entity_name', public.ucat_mock_catalog_name(parent.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    JOIN public.ucat_mocks parent ON parent.id = child.mock_id
    WHERE child.id = p_content_id AND parent.deleted_at IS NULL
      AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'));
    IF p_status = 'in_review' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', 'draft_child_stem',
        'message', format(
          'This set contains the draft question “%s”. Send it for review first.',
          COALESCE(NULLIF(BTRIM(LEFT(public.extract_text_from_prosemirror_json(stem.stem_text), 80)), ''), 'Untitled question')
        ),
        'entity_type', 'stem',
        'entity_id', stem.id,
        'entity_name', COALESCE(NULLIF(BTRIM(LEFT(public.extract_text_from_prosemirror_json(stem.stem_text), 80)), ''), 'Untitled question')
      ) ORDER BY stem.id), '[]'::JSONB)
      INTO v_child_blockers
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (stem.deleted_at IS NOT NULL OR stem.status = 'draft');
      v_blockers := v_blockers || v_child_blockers;
    END IF;
  ELSIF p_content_type = 'mock' AND p_status = 'in_review' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'deleted_child_set',
      'message', format(
        'This mock contains the deleted set “%s”. Restore or replace it before sending the mock for review.',
        public.ucat_question_set_catalog_name(child.id)
      ),
      'entity_type', 'set', 'entity_id', child.id,
      'entity_name', public.ucat_question_set_catalog_name(child.id)
    ) ORDER BY child.created_at, child.id), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    WHERE child.mock_id = p_content_id
      AND child.deleted_at IS NOT NULL;
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', issue->>'code',
        'message', format(
          '“%s”: %s',
          public.ucat_question_set_catalog_name(child.id),
          issue->>'message'
        ),
        'entity_type', COALESCE(NULLIF(issue->>'entity_type', ''), 'set'),
        'entity_id', COALESCE(NULLIF(issue->>'entity_id', ''), child.id::TEXT),
        'entity_name', COALESCE(
          NULLIF(issue->>'entity_name', ''),
          public.ucat_question_set_catalog_name(child.id)
        )
      )
      ORDER BY child.created_at, child.id, issue->>'code'
    ), '[]'::JSONB)
    INTO v_child_blockers
    FROM public.question_sets child
    CROSS JOIN LATERAL jsonb_array_elements(
      public.tutor_ucat_content_status_blockers('set', child.id, 'in_review')
    ) issue
    WHERE child.mock_id = p_content_id
      AND child.deleted_at IS NULL
      AND child.status = 'draft';
    v_blockers := v_blockers || v_child_blockers;
  END IF;
  RETURN v_blockers;
END;
$$;
