-- A question set belongs to exactly one authored UCAT section.
-- Membership must match; mixed-section sets are stripped to the majority section.

ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.ucat_sections(id);

WITH ranked AS (
  SELECT
    member.question_set_id,
    stem.section_id,
    count(*) AS stem_count,
    min(section.section_number) AS section_number
  FROM public.question_stems_question_sets member
  JOIN public.question_stems stem
    ON stem.id = member.question_stem_id
   AND stem.deleted_at IS NULL
  JOIN public.ucat_sections section ON section.id = stem.section_id
  GROUP BY member.question_set_id, stem.section_id
),
picked AS (
  SELECT DISTINCT ON (question_set_id)
    question_set_id,
    section_id
  FROM ranked
  ORDER BY question_set_id, stem_count DESC, section_number ASC, section_id
)
UPDATE public.question_sets question_set
SET section_id = picked.section_id
FROM picked
WHERE question_set.id = picked.question_set_id
  AND question_set.section_id IS NULL;

UPDATE public.question_sets question_set
SET section_id = section.id
FROM public.ucat_sections section
WHERE question_set.section_id IS NULL
  AND lower(btrim(question_set.name #>> '{content,0,content,0,text}')) = lower(btrim(section.name));

UPDATE public.question_sets
SET section_id = (
  SELECT id FROM public.ucat_sections ORDER BY section_number NULLS LAST, id LIMIT 1
)
WHERE section_id IS NULL;

DELETE FROM public.question_stems_question_sets member
USING public.question_sets question_set, public.question_stems stem
WHERE member.question_set_id = question_set.id
  AND member.question_stem_id = stem.id
  AND stem.section_id IS DISTINCT FROM question_set.section_id;

ALTER TABLE public.question_sets
  ALTER COLUMN section_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_question_sets_section ON public.question_sets(section_id);

CREATE OR REPLACE FUNCTION public.ucat_question_set_enforce_section_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.section_id IS DISTINCT FROM NEW.section_id
    AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      WHERE member.question_set_id = NEW.id
    )
  THEN
    RAISE EXCEPTION 'question_set_section_has_members';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ucat_question_set_section_change ON public.question_sets;
CREATE TRIGGER trg_ucat_question_set_section_change
  BEFORE UPDATE OF section_id ON public.question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_question_set_enforce_section_change();

CREATE OR REPLACE FUNCTION public.ucat_question_set_enforce_stem_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_set_section_id UUID;
  v_stem_section_id UUID;
BEGIN
  SELECT section_id INTO v_set_section_id
  FROM public.question_sets
  WHERE id = NEW.question_set_id;

  SELECT section_id INTO v_stem_section_id
  FROM public.question_stems
  WHERE id = NEW.question_stem_id;

  IF v_set_section_id IS DISTINCT FROM v_stem_section_id THEN
    RAISE EXCEPTION 'question_set_stem_section_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ucat_question_set_stem_membership ON public.question_stems_question_sets;
CREATE TRIGGER trg_ucat_question_set_stem_membership
  BEFORE INSERT OR UPDATE OF question_stem_id, question_set_id ON public.question_stems_question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_question_set_enforce_stem_membership();

CREATE OR REPLACE FUNCTION public.ucat_question_stem_enforce_live_set_section()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.section_id IS DISTINCT FROM NEW.section_id
    AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      WHERE member.question_stem_id = NEW.id
        AND question_set.deleted_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'question_stem_section_frozen_by_set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ucat_question_stem_live_set_section ON public.question_stems;
CREATE TRIGGER trg_ucat_question_stem_live_set_section
  BEFORE UPDATE OF section_id ON public.question_stems
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_question_stem_enforce_live_set_section();

DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set_before_mock_blueprint_guard(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB);

CREATE FUNCTION public.tutor_ucat_upsert_question_set_before_mock_blueprint_guard(
  p_set_id UUID,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
  v_status public.ucat_content_status;
  v_issues JSONB;
  v_current_section_id UUID;
  v_has_members BOOLEAN;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_section_id IS NULL THEN RAISE EXCEPTION 'question_set_section_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_sections WHERE id = p_section_id) THEN
    RAISE EXCEPTION 'ucat_section_not_found';
  END IF;

  IF p_set_id IS NULL THEN
    INSERT INTO public.question_sets (
      name, description, time_limit_seconds, status, access_scope, section_id, created_by, updated_by
    ) VALUES (
      p_name, p_description, p_time_limit_seconds, 'draft', COALESCE(p_access_scope, 'public'),
      p_section_id, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_set_id, v_status;
  ELSE
    SELECT section_id, EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member WHERE member.question_set_id = p_set_id
    )
    INTO v_current_section_id, v_has_members
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'question_set_not_found'; END IF;
    IF p_section_id IS DISTINCT FROM v_current_section_id AND v_has_members THEN
      RAISE EXCEPTION 'question_set_section_has_members';
    END IF;

    UPDATE public.question_sets
    SET name = p_name,
        description = p_description,
        time_limit_seconds = p_time_limit_seconds,
        section_id = p_section_id,
        updated_by = v_staff_id
    WHERE id = p_set_id AND deleted_at IS NULL
    RETURNING id, status INTO v_set_id, v_status;
    IF v_set_id IS NULL THEN RAISE EXCEPTION 'question_set_not_found'; END IF;
  END IF;

  DELETE FROM public.question_stems_question_sets WHERE question_set_id = v_set_id;
  FOR v_stem_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_stem_ids, '[]'::jsonb))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.question_stems WHERE id = v_stem_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'question_stem_not_found';
    END IF;
    v_index := v_index + 1;
    INSERT INTO public.question_stems_question_sets (
      question_stem_id, question_set_id, index, created_by, updated_by
    ) VALUES (v_stem_id, v_set_id, v_index, v_staff_id, v_staff_id);
  END LOOP;

  PERFORM public.tutor_ucat_set_content_access('set', v_set_id, COALESCE(p_access_scope, 'public'));

  IF v_status = 'in_review' AND EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_stems child ON child.id = member.question_stem_id
    WHERE member.question_set_id = v_set_id AND child.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'in_review_set_contains_draft_stem';
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT; END IF;
  END IF;
  RETURN v_set_id;
END;
$$;

CREATE FUNCTION public.tutor_ucat_upsert_question_set(
  p_set_id UUID,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_invalid_mock UUID;
BEGIN
  v_set_id := public.tutor_ucat_upsert_question_set_before_mock_blueprint_guard(
    p_set_id, p_name, p_description, p_time_limit_seconds, p_access_scope, p_stem_ids, p_section_id
  );

  SELECT parent.id INTO v_invalid_mock
  FROM public.question_sets_ucat_mocks member
  JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
  WHERE member.question_set_id = v_set_id
    AND parent.deleted_at IS NULL
    AND parent.status = 'published'
    AND parent.blueprint_id IS NOT NULL
    AND NOT (public.ucat_mock_blueprint_compliance(parent.id)->>'compliant')::boolean
  ORDER BY parent.id
  LIMIT 1;

  IF v_invalid_mock IS NOT NULL THEN
    RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_invalid_mock;
  END IF;
  RETURN v_set_id;
END;
$$;

CREATE FUNCTION public.tutor_ucat_upsert_question_set(
  p_set_id UUID,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_id UUID;
BEGIN
  IF p_set_id IS NULL THEN RAISE EXCEPTION 'question_set_section_required'; END IF;
  SELECT section_id INTO v_section_id
  FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL;
  IF v_section_id IS NULL THEN RAISE EXCEPTION 'question_set_not_found'; END IF;
  RETURN public.tutor_ucat_upsert_question_set(
    p_set_id, p_name, p_description, p_time_limit_seconds, p_access_scope, p_stem_ids, v_section_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set_before_mock_blueprint_guard(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.tutor_ucat_mcp_upsert_question_set(UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, JSONB);

CREATE FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  p_set_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_set_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_set_id IS NOT NULL THEN
    SELECT updated_at, status
    INTO v_before_updated_at, v_status
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;
    IF v_status = 'published' THEN
      RAISE EXCEPTION 'mcp_published_content_read_only';
    END IF;
    IF p_expected_updated_at IS NULL
      OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_set_id := public.tutor_ucat_upsert_question_set(
    p_set_id,
    p_name,
    COALESCE(p_description, '{}'::JSONB),
    p_time_limit_seconds,
    COALESCE(p_access_scope, 'public'),
    COALESCE(p_stem_ids, '[]'::JSONB),
    p_section_id
  );

  SELECT status, updated_at
  INTO v_status, v_after_updated_at
  FROM public.question_sets
  WHERE id = v_set_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'question_sets',
    v_set_id,
    CASE WHEN p_set_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_set_id IS NULL THEN 'create_question_set' ELSE 'update_question_set' END,
    v_before_updated_at,
    v_after_updated_at,
    p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_set_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_set_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem
      ON stem.id = member.question_stem_id
     AND stem.deleted_at IS NULL
    JOIN public.question_sets question_set ON question_set.id = p_set_id
    WHERE member.question_set_id = p_set_id
      AND stem.section_id IS DISTINCT FROM question_set.section_id
  ) THEN
    RAISE EXCEPTION 'question_set_restore_section_mismatch';
  END IF;
  UPDATE public.question_sets
  SET deleted_at = NULL, deleted_by = NULL, status = 'draft', status_changed_at = NOW(),
      status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  question_set.id, question_set.name, question_set.description, question_set.time_limit_seconds,
  question_set.status, question_set.access_scope,
  (question_set.status = 'published' AND question_set.access_scope = 'public' AND NOT EXISTS (
    SELECT 1 FROM public.question_sets_ucat_mocks pool_member
    JOIN public.ucat_mocks pool_parent ON pool_parent.id = pool_member.ucat_mock_id
    WHERE pool_member.question_set_id = question_set.id AND pool_parent.deleted_at IS NULL AND pool_parent.status = 'published'
  )) AS is_available_in_sets_pool,
  question_set.status_changed_at, question_set.status_changed_by, question_set.sections,
  question_set.time_limit_at_exam_speed_seconds, question_set.speed,
  question_set.created_at, question_set.updated_at, question_set.created_by, question_set.updated_by,
  question_set.deleted_at, question_set.deleted_by,
  created_staff.first_name AS created_by_first_name, created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::integer FROM public.question_stems_question_sets member WHERE member.question_set_id = question_set.id) AS stem_count,
  (SELECT count(*)::integer FROM public.ucat_questions question JOIN public.question_stems_question_sets member ON member.question_stem_id = question.question_stem_id WHERE member.question_set_id = question_set.id AND question.deleted_at IS NULL) AS question_count,
  (SELECT coalesce(jsonb_agg(member.ucat_mock_id ORDER BY member.index NULLS LAST, member.ucat_mock_id), '[]'::jsonb) FROM public.question_sets_ucat_mocks member JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id AND parent.deleted_at IS NULL WHERE member.question_set_id = question_set.id) AS ucat_mock_ids,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mockId', parent.id,
    'mockName', parent.name,
    'blueprintId', parent.blueprint_id,
    'setIds', (SELECT coalesce(jsonb_agg(mock_member.question_set_id ORDER BY mock_member.index), '[]'::jsonb)
      FROM public.question_sets_ucat_mocks mock_member WHERE mock_member.ucat_mock_id = parent.id),
    'compliance', public.ucat_mock_blueprint_compliance(parent.id)
  ) ORDER BY parent.name, parent.id), '[]'::jsonb)
  FROM public.question_sets_ucat_mocks member
  JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id AND parent.deleted_at IS NULL
  WHERE member.question_set_id = question_set.id AND parent.blueprint_id IS NOT NULL) AS linked_mock_blueprint_compliance,
  question_set.section_id,
  section.section_number,
  section.name AS section_name
FROM public.question_sets question_set
LEFT JOIN public.staff created_staff ON created_staff.id = question_set.created_by
JOIN public.ucat_sections section ON section.id = question_set.section_id
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  question_set.id,
  question_set.name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.status,
  question_set.access_scope,
  question_set.status_changed_at,
  question_set.status_changed_by,
  question_set.created_at,
  question_set.updated_at,
  question_set.created_by,
  question_set.updated_by,
  question_set.deleted_at,
  question_set.deleted_by,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'stem_id', stem.id,
      'stem_text', stem.stem_text,
      'status', stem.status,
      'access_scope', stem.access_scope,
      'questions_meta', (
        SELECT json_agg(json_build_object('id', question.id, 'index', question.index) ORDER BY question.index)
        FROM public.ucat_questions question
        WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
      )
    ) ORDER BY member.index)
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem ON stem.id = member.question_stem_id
    WHERE member.question_set_id = question_set.id
  ) AS stems,
  question_set.section_id,
  section.section_number,
  section.name AS section_name
FROM public.question_sets question_set
JOIN public.ucat_sections section ON section.id = question_set.section_id
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  question_set.id,
  question_set.name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  (
    question_set.status = 'published'
    AND question_set.access_scope = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
      WHERE member.question_set_id = question_set.id
        AND parent.deleted_at IS NULL
        AND parent.status = 'published'
    )
  ) AS is_available_in_sets_library,
  question_set.section_id,
  section.section_number
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id
JOIN public.ucat_sections section ON section.id = question_set.section_id;

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;
GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;
