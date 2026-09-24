-- Separate UCAT authoring lifecycle from student access.
-- Live catalogue content is editable in place; attempts retain immutable content snapshots.

DO $$ BEGIN
  CREATE TYPE public.ucat_content_status AS ENUM ('draft', 'in_review', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ucat_access_scope AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.question_stems
  ADD COLUMN status public.ucat_content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN access_scope public.ucat_access_scope NOT NULL DEFAULT 'public',
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN status_changed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.question_sets
  ADD COLUMN status public.ucat_content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN access_scope public.ucat_access_scope NOT NULL DEFAULT 'public',
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN status_changed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.ucat_mocks
  ADD COLUMN status public.ucat_content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN access_scope public.ucat_access_scope NOT NULL DEFAULT 'public',
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN status_changed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

UPDATE public.question_stems
SET status = CASE approval_status
      WHEN 'pending' THEN 'in_review'::public.ucat_content_status
      WHEN 'rejected' THEN 'draft'::public.ucat_content_status
      ELSE 'published'::public.ucat_content_status
    END,
    access_scope = CASE WHEN is_private THEN 'private' ELSE 'public' END::public.ucat_access_scope,
    status_changed_at = COALESCE(approved_at, updated_at, created_at, NOW()),
    status_changed_by = COALESCE(approved_by, updated_by, created_by),
    published_at = CASE WHEN approval_status = 'approved' THEN COALESCE(approved_at, updated_at, created_at, NOW()) END,
    published_by = CASE WHEN approval_status = 'approved' THEN COALESCE(approved_by, updated_by, created_by) END;

UPDATE public.question_sets
SET status = 'published',
    access_scope = CASE WHEN is_private THEN 'private' ELSE 'public' END::public.ucat_access_scope,
    status_changed_at = COALESCE(updated_at, created_at, NOW()),
    status_changed_by = COALESCE(updated_by, created_by),
    published_at = COALESCE(updated_at, created_at, NOW()),
    published_by = COALESCE(updated_by, created_by)
WHERE is_student_generated = false;

UPDATE public.ucat_mocks
SET status = 'published',
    access_scope = CASE WHEN is_private THEN 'private' ELSE 'public' END::public.ucat_access_scope,
    status_changed_at = COALESCE(updated_at, created_at, NOW()),
    status_changed_by = COALESCE(updated_by, created_by),
    published_at = COALESCE(updated_at, created_at, NOW()),
    published_by = COALESCE(updated_by, created_by);

CREATE INDEX idx_question_stems_status_access
  ON public.question_stems(status, access_scope)
WHERE deleted_at IS NULL;

-- Pre-production clean break: remove superseded overloads and columns rather
-- than carrying two competing lifecycle models.
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_mock(UUID, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_mock(UUID, TEXT, BOOLEAN, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, BOOLEAN, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_set_question_stem_approval(UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB, public.ucat_question_source_channel, TEXT);
DROP FUNCTION IF EXISTS public.tutor_ucat_bulk_update_question_stem_metadata(UUID[], UUID, BOOLEAN);

ALTER TABLE public.question_stems
  DROP COLUMN approval_status CASCADE,
  DROP COLUMN approved_at CASCADE,
  DROP COLUMN approved_by CASCADE,
  DROP COLUMN is_ai_generated CASCADE,
  DROP COLUMN is_private CASCADE;
ALTER TABLE public.question_sets
  DROP COLUMN is_private CASCADE,
  DROP COLUMN is_student_generated CASCADE;
ALTER TABLE public.ucat_mocks
  DROP COLUMN is_private CASCADE;
CREATE INDEX idx_question_sets_status_access
  ON public.question_sets(status, access_scope)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_ucat_mocks_status_access
  ON public.ucat_mocks(status, access_scope)
  WHERE deleted_at IS NULL;

ALTER TABLE public.student_question_attempts
  ADD COLUMN content_snapshot JSONB;

ALTER TABLE public.student_question_attempts
  DROP CONSTRAINT IF EXISTS student_question_attempts_question_id_fkey,
  ALTER COLUMN question_id DROP NOT NULL,
  ADD CONSTRAINT student_question_attempts_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.ucat_questions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.ucat_question_content_snapshot(p_question_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'stem', jsonb_build_object(
      'id', stem.id,
      'sectionId', stem.section_id,
      'sectionNumber', section.section_number,
      'sectionName', section.name,
      'sectionDisplayColumns', section.display_columns,
      'categoryId', stem.question_stem_category_id,
      'categoryName', category.name,
      'categoryDescription', category.description,
      'stemText', stem.stem_text
    ),
    'question', jsonb_build_object(
      'id', question.id,
      'questionText', question.question_text,
      'answerExplanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'timeBurdenSeconds', question.time_burden_seconds,
      'questionType', question.question_type,
      'tags', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'description', tag.description) ORDER BY tag.name, tag.id)
        FROM public.questions_question_tags question_tag
        JOIN public.question_tags tag ON tag.id = question_tag.tag_id
        WHERE question_tag.question_id = question.id
      ), '[]'::jsonb)
    ),
    'answerOptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', option.id,
        'answerText', option.answer_text,
        'answerExplanation', option.answer_explanation,
        'index', option.index,
        'isAnswer', option.is_answer
      ) ORDER BY option.index, option.id)
      FROM public.question_answer_options option
      WHERE option.question_id = question.id
        AND option.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
  WHERE question.id = p_question_id;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_content_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_question_content_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_ucat_question_attempt_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_snapshot := COALESCE(NEW.content_snapshot, public.ucat_question_content_snapshot(NEW.question_id));
    IF NEW.content_snapshot IS NULL THEN
      RAISE EXCEPTION 'question_snapshot_not_found';
    END IF;
  ELSE
    NEW.content_snapshot := OLD.content_snapshot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_ucat_question_attempt_content ON public.student_question_attempts;
CREATE TRIGGER capture_ucat_question_attempt_content
  BEFORE INSERT OR UPDATE OF content_snapshot, question_id
  ON public.student_question_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_ucat_question_attempt_content();

UPDATE public.student_question_attempts attempt
SET content_snapshot = public.ucat_question_content_snapshot(attempt.question_id)
WHERE content_snapshot IS NULL
  AND question_id IS NOT NULL;

ALTER TABLE public.student_question_attempts
  ADD CONSTRAINT student_question_attempts_content_snapshot_required
  CHECK (content_snapshot IS NOT NULL) NOT VALID;

COMMENT ON COLUMN public.student_question_attempts.content_snapshot IS
  'Immutable question, stem, option, answer, and explanation content captured when the attempt row is created.';

CREATE OR REPLACE FUNCTION public.ucat_rich_text_has_content(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value IS NOT NULL
    AND p_value <> 'null'::jsonb
    AND (
      p_value::TEXT ~ '"text"[[:space:]]*:[[:space:]]*"[^"[:space:]]'
      OR p_value::TEXT ~ '"type"[[:space:]]*:[[:space:]]*"(image|table|hardBreak)"'
    );
$$;

CREATE OR REPLACE FUNCTION public.ucat_content_publication_issues(
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
  v_issues JSONB := '[]'::jsonb;
  v_access public.ucat_access_scope;
BEGIN
  IF p_content_type = 'stem' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Question stem not found.'));
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND question_stem_category_id IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_category', 'message', 'Choose a stem category.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.ucat_questions
      WHERE question_stem_id = p_content_id AND deleted_at IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_questions', 'message', 'Add at least one question.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.questions_question_tags question_tag
          WHERE question_tag.question_id = question.id
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_tags', 'message', 'Every question needs at least one tag.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          (question.question_type = 'multiple_choice' AND NOT public.ucat_rich_text_has_content(question.answer_explanation))
          OR (question.question_type = 'syllogism' AND EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_explanation)
          ))
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_explanations', 'message', 'Complete every required answer explanation.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          NOT public.ucat_rich_text_has_content(question.question_text)
          OR (SELECT COUNT(*) FROM public.question_answer_options option WHERE option.question_id = question.id AND option.deleted_at IS NULL) < 2
          OR EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_text)
          )
          OR (
            question.question_type = 'multiple_choice'
            AND (SELECT COUNT(*) FROM public.question_answer_options option WHERE option.question_id = question.id AND option.deleted_at IS NULL AND option.is_answer) <> 1
          )
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'invalid_answer_structure', 'message', 'Every question needs valid answer options and a valid correct answer.'));
    END IF;

  ELSIF p_content_type = 'set' THEN
    SELECT access_scope INTO v_access
    FROM public.question_sets
    WHERE id = p_content_id AND deleted_at IS NULL;

    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Question set not found.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems_question_sets
      WHERE question_set_id = p_content_id
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_stems', 'message', 'Add at least one question stem.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (stem.deleted_at IS NOT NULL OR stem.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'unpublished_children', 'message', 'Every stem in a published set must be published.'));
    END IF;

    IF v_access = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND stem.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'private_children', 'message', 'A public set cannot contain private stems.'));
    END IF;

  ELSIF p_content_type = 'mock' THEN
    SELECT access_scope INTO v_access
    FROM public.ucat_mocks
    WHERE id = p_content_id AND deleted_at IS NULL;

    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Mock exam not found.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.question_sets_ucat_mocks
      WHERE ucat_mock_id = p_content_id
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_sets', 'message', 'Add at least one question set.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND (question_set.deleted_at IS NOT NULL OR question_set.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'unpublished_children', 'message', 'Every set in a published mock must be published.'));
    END IF;

    IF v_access = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND question_set.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'private_children', 'message', 'A public mock cannot contain private sets.'));
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_access(
  p_content_type TEXT,
  p_content_id UUID,
  p_access_scope public.ucat_access_scope
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_content_type = 'stem' THEN
    IF p_access_scope = 'private' AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_sets parent ON parent.id = member.question_set_id
      WHERE member.question_stem_id = p_content_id
        AND parent.deleted_at IS NULL
        AND parent.access_scope = 'public'
    ) THEN
      RAISE EXCEPTION 'private_child_of_public_set';
    END IF;
    UPDATE public.question_stems
    SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'set' THEN
    IF p_access_scope = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems child ON child.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND child.deleted_at IS NULL
        AND child.access_scope = 'private'
    ) THEN
      RAISE EXCEPTION 'public_set_contains_private_stem';
    END IF;
    IF p_access_scope = 'private' AND EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
      WHERE member.question_set_id = p_content_id
        AND parent.deleted_at IS NULL
        AND parent.access_scope = 'public'
    ) THEN
      RAISE EXCEPTION 'private_child_of_public_mock';
    END IF;
    UPDATE public.question_sets
    SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'mock' THEN
    IF p_access_scope = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets child ON child.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND child.deleted_at IS NULL
        AND child.access_scope = 'private'
    ) THEN
      RAISE EXCEPTION 'public_mock_contains_private_set';
    END IF;
    UPDATE public.ucat_mocks
    SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ucat_content_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_content_access(TEXT, UUID, public.ucat_access_scope) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_access(TEXT, UUID, public.ucat_access_scope) TO authenticated;

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
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_content_type = 'stem' THEN
    SELECT status INTO v_current FROM public.question_stems WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'set' THEN
    SELECT status INTO v_current FROM public.question_sets WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'mock' THEN
    SELECT status INTO v_current FROM public.ucat_mocks WHERE id = p_content_id AND deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'ucat_content_not_found';
  END IF;
  IF v_current = p_status THEN
    RETURN;
  END IF;
  IF v_current = 'draft' AND p_status = 'published' THEN
    RAISE EXCEPTION 'send_content_for_review_before_publishing';
  END IF;

  IF p_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues(p_content_type, p_content_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'publication_blocked:%', v_issues::TEXT;
    END IF;
  END IF;

  IF p_status <> 'published' THEN
    IF p_content_type = 'stem' THEN
      IF EXISTS (
        SELECT 1 FROM public.question_stems_question_sets member
        JOIN public.question_sets parent ON parent.id = member.question_set_id
        WHERE member.question_stem_id = p_content_id
          AND parent.deleted_at IS NULL
          AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
      ) THEN
        RAISE EXCEPTION 'status_blocked_by_parent_set';
      END IF;
      IF EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE question_stem_id = p_content_id)
        OR EXISTS (
          SELECT 1 FROM public.ucat_learning_module_blocks block
          LEFT JOIN public.ucat_questions question ON question.id = block.question_id
          WHERE block.deleted_at IS NULL
            AND (block.question_stem_id = p_content_id OR question.question_stem_id = p_content_id)
        )
      THEN
        RAISE EXCEPTION 'status_blocked_by_attachment';
      END IF;
    ELSIF p_content_type = 'set' THEN
      IF EXISTS (
        SELECT 1 FROM public.question_sets_ucat_mocks member
        JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
        WHERE member.question_set_id = p_content_id
          AND parent.deleted_at IS NULL
          AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
      ) THEN
        RAISE EXCEPTION 'status_blocked_by_parent_mock';
      END IF;
      IF EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE question_set_id = p_content_id) THEN
        RAISE EXCEPTION 'status_blocked_by_attachment';
      END IF;
    ELSIF p_content_type = 'mock' THEN
      IF EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE ucat_mock_id = p_content_id) THEN
        RAISE EXCEPTION 'status_blocked_by_attachment';
      END IF;
    END IF;
  END IF;

  IF p_status = 'in_review' THEN
    IF p_content_type = 'set' AND EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member
      JOIN public.question_stems child ON child.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
    ) THEN
      RAISE EXCEPTION 'in_review_set_contains_draft_stem';
    END IF;
    IF p_content_type = 'mock' AND EXISTS (
      SELECT 1 FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets child ON child.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
    ) THEN
      RAISE EXCEPTION 'in_review_mock_contains_draft_set';
    END IF;
  END IF;

  IF p_content_type = 'stem' THEN
    UPDATE public.question_stems
    SET status = p_status, status_changed_at = NOW(), status_changed_by = v_staff_id,
        published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
        published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
        updated_by = v_staff_id
    WHERE id = p_content_id;
  ELSIF p_content_type = 'set' THEN
    UPDATE public.question_sets
    SET status = p_status, status_changed_at = NOW(), status_changed_by = v_staff_id,
        published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
        published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
        updated_by = v_staff_id
    WHERE id = p_content_id;
  ELSE
    UPDATE public.ucat_mocks
    SET status = p_status, status_changed_at = NOW(), status_changed_by = v_staff_id,
        published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
        published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
        updated_by = v_staff_id
    WHERE id = p_content_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_content_status(TEXT, UUID, public.ucat_content_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_status(TEXT, UUID, public.ucat_content_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_staff_id UUID;
  v_status public.ucat_content_status;
  v_question JSONB;
  v_question_id UUID;
  v_question_ids UUID[] := ARRAY[]::UUID[];
  v_option JSONB;
  v_option_id UUID;
  v_option_ids UUID[];
  v_tag_id UUID;
  v_file_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_stem_id IS NULL THEN
    INSERT INTO public.question_stems (
      section_id, question_stem_category_id, stem_text, status, access_scope,
      source_channel, tutor_source_note, created_by, updated_by
    ) VALUES (
      p_section_id, p_question_stem_category_id, COALESCE(p_stem_text, '{}'::jsonb),
      'draft', COALESCE(p_access_scope, 'public'),
      COALESCE(p_source_channel, 'individual'), NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
      v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_stem_id, v_status;
  ELSE
    UPDATE public.question_stems
    SET section_id = p_section_id,
        question_stem_category_id = p_question_stem_category_id,
        stem_text = COALESCE(p_stem_text, '{}'::jsonb),
        tutor_source_note = NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
        updated_by = v_staff_id
    WHERE id = p_stem_id AND deleted_at IS NULL
    RETURNING id, status INTO v_stem_id, v_status;
    IF v_stem_id IS NULL THEN RAISE EXCEPTION 'question_stem_not_found'; END IF;
    PERFORM public.tutor_ucat_set_content_access('stem', v_stem_id, COALESCE(p_access_scope, 'public'));
  END IF;

  DELETE FROM public.question_stems_files WHERE question_stem_id = v_stem_id;
  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT v_stem_id, file_id
  FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(p_stem_text, '{}'::jsonb))) AS file_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  FOR v_question IN SELECT * FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
  LOOP
    v_question_id := NULLIF(v_question->>'id', '')::UUID;
    IF v_question_id IS NOT NULL THEN
      UPDATE public.ucat_questions
      SET question_text = COALESCE(v_question->'question_text', '{}'::jsonb),
          answer_explanation = NULLIF(v_question->'answer_explanation', 'null'::jsonb),
          index = COALESCE((v_question->>'index')::INTEGER, 1),
          difficulty = NULLIF(v_question->>'difficulty', '')::NUMERIC,
          time_burden_seconds = NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
          question_type = COALESCE((v_question->>'question_type')::public.ucat_question_type, 'multiple_choice'),
          source_channel = COALESCE(NULLIF(v_question->>'source_channel', '')::public.ucat_question_source_channel, source_channel),
          ai_generation_metadata = NULLIF(v_question->'ai_generation_metadata', 'null'::jsonb),
          deleted_at = NULL,
          deleted_by = NULL,
          updated_by = v_staff_id
      WHERE id = v_question_id AND question_stem_id = v_stem_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'question_does_not_belong_to_stem'; END IF;
    ELSE
      INSERT INTO public.ucat_questions (
        question_stem_id, question_text, answer_explanation, index, difficulty,
        time_burden_seconds, question_type, source_channel, ai_generation_metadata,
        created_by, updated_by
      ) VALUES (
        v_stem_id, COALESCE(v_question->'question_text', '{}'::jsonb),
        NULLIF(v_question->'answer_explanation', 'null'::jsonb),
        COALESCE((v_question->>'index')::INTEGER, 1),
        NULLIF(v_question->>'difficulty', '')::NUMERIC,
        NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
        COALESCE((v_question->>'question_type')::public.ucat_question_type, 'multiple_choice'),
        COALESCE(NULLIF(v_question->>'source_channel', '')::public.ucat_question_source_channel, p_source_channel, 'individual'),
        NULLIF(v_question->'ai_generation_metadata', 'null'::jsonb),
        v_staff_id, v_staff_id
      ) RETURNING id INTO v_question_id;
    END IF;
    v_question_ids := array_append(v_question_ids, v_question_id);

    DELETE FROM public.questions_files WHERE question_id = v_question_id;
    INSERT INTO public.questions_files (question_id, file_id)
    SELECT v_question_id, file_id
    FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(v_question->'question_text', '{}'::jsonb))) AS file_id
    ON CONFLICT (question_id, file_id) DO NOTHING;

    DELETE FROM public.questions_question_tags WHERE question_id = v_question_id;
    FOR v_tag_id IN
      SELECT DISTINCT NULLIF(value::TEXT, '')::UUID
      FROM jsonb_array_elements_text(COALESCE(v_question->'tag_ids', '[]'::jsonb))
    LOOP
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO public.questions_question_tags (question_id, tag_id, created_by)
        VALUES (v_question_id, v_tag_id, v_staff_id)
        ON CONFLICT (question_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;

    v_option_ids := ARRAY[]::UUID[];
    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_question->'answer_options', '[]'::jsonb))
    LOOP
      v_option_id := NULLIF(v_option->>'id', '')::UUID;
      IF v_option_id IS NOT NULL THEN
        UPDATE public.question_answer_options
        SET answer_text = COALESCE(v_option->'answer_text', '{}'::jsonb),
            answer_explanation = NULLIF(v_option->'answer_explanation', 'null'::jsonb),
            index = COALESCE((v_option->>'index')::INTEGER, 1),
            is_answer = COALESCE((v_option->>'is_answer')::BOOLEAN, false),
            deleted_at = NULL,
            deleted_by = NULL,
            updated_by = v_staff_id
        WHERE id = v_option_id AND question_id = v_question_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'answer_option_does_not_belong_to_question'; END IF;
      ELSE
        INSERT INTO public.question_answer_options (
          question_id, answer_text, answer_explanation, index, is_answer, created_by, updated_by
        ) VALUES (
          v_question_id, COALESCE(v_option->'answer_text', '{}'::jsonb),
          NULLIF(v_option->'answer_explanation', 'null'::jsonb),
          COALESCE((v_option->>'index')::INTEGER, 1),
          COALESCE((v_option->>'is_answer')::BOOLEAN, false), v_staff_id, v_staff_id
        ) RETURNING id INTO v_option_id;
      END IF;
      v_option_ids := array_append(v_option_ids, v_option_id);

      DELETE FROM public.answer_option_files WHERE answer_option_id = v_option_id;
      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_text', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_text')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;
      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_explanation', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_explanation')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;
    END LOOP;

    UPDATE public.question_answer_options
    SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id
    WHERE question_id = v_question_id
      AND deleted_at IS NULL
      AND NOT (id = ANY(v_option_ids));
  END LOOP;

  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id
  WHERE question_stem_id = v_stem_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_question_ids));

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('stem', v_stem_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  RETURN v_stem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB, public.ucat_question_source_channel, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB, public.ucat_question_source_channel, TEXT) TO authenticated;

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
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN RAISE EXCEPTION 'invalid_stems_payload'; END IF;

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
    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;
  RETURN v_result_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(
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
      COALESCE(NULLIF(v_stem->>'accessScope', '')::public.ucat_access_scope, 'private'),
      COALESCE(v_stem->'questions', '[]'::jsonb),
      'ai_generation',
      v_stem->>'tutorSourceNote'
    );
    UPDATE public.question_stems
    SET status = 'in_review',
        status_changed_at = NOW(),
        status_changed_by = v_staff_id,
        source_channel = 'ai_generation',
        ai_generation_metadata = NULLIF(COALESCE(v_stem->'ai_generation_metadata', '{}'::jsonb), '{}'::jsonb),
        updated_by = v_staff_id
    WHERE id = v_stem_id;
    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;
  RETURN v_result_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_set(
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
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
  v_status public.ucat_content_status;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();

  IF p_set_id IS NULL THEN
    INSERT INTO public.question_sets (
      name, description, time_limit_seconds, status, access_scope, created_by, updated_by
    ) VALUES (
      p_name, p_description, p_time_limit_seconds, 'draft', COALESCE(p_access_scope, 'public'), v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_set_id, v_status;
  ELSE
    UPDATE public.question_sets
    SET name = p_name,
        description = p_description,
        time_limit_seconds = p_time_limit_seconds,
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

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock(
  p_mock_id UUID,
  p_name TEXT,
  p_access_scope public.ucat_access_scope,
  p_set_ids JSONB,
  p_instructions_text JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_staff_id UUID;
  v_set_id UUID;
  v_index INTEGER := 0;
  v_status public.ucat_content_status;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    INSERT INTO public.ucat_mocks (
      name, access_scope, status, instructions_text, created_by, updated_by
    ) VALUES (
      COALESCE(NULLIF(BTRIM(p_name), ''), 'Untitled Mock'), COALESCE(p_access_scope, 'public'),
      'draft', p_instructions_text, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_mock_id, v_status;
  ELSE
    UPDATE public.ucat_mocks
    SET name = COALESCE(NULLIF(BTRIM(p_name), ''), name),
        instructions_text = p_instructions_text,
        updated_by = v_staff_id
    WHERE id = p_mock_id AND deleted_at IS NULL
    RETURNING id, status INTO v_mock_id, v_status;
    IF v_mock_id IS NULL THEN RAISE EXCEPTION 'mock_not_found'; END IF;
  END IF;

  DELETE FROM public.question_sets_ucat_mocks WHERE ucat_mock_id = v_mock_id;
  FOR v_set_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_set_ids, '[]'::jsonb))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.question_sets WHERE id = v_set_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;
    v_index := v_index + 1;
    INSERT INTO public.question_sets_ucat_mocks (
      question_set_id, ucat_mock_id, index, created_by, updated_by
    ) VALUES (v_set_id, v_mock_id, v_index, v_staff_id, v_staff_id);
  END LOOP;

  PERFORM public.tutor_ucat_set_content_access('mock', v_mock_id, COALESCE(p_access_scope, 'public'));

  IF v_status = 'in_review' AND EXISTS (
    SELECT 1 FROM public.question_sets_ucat_mocks member
    JOIN public.question_sets child ON child.id = member.question_set_id
    WHERE member.ucat_mock_id = v_mock_id AND child.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'in_review_mock_contains_draft_set';
  END IF;
  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT; END IF;
  END IF;
  RETURN v_mock_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, public.ucat_access_scope, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, public.ucat_access_scope, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_published_ucat_session_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.question_stem_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.question_stems
    WHERE id = NEW.question_stem_id AND deleted_at IS NULL AND status = 'published'
  ) THEN RAISE EXCEPTION 'only_published_stems_can_be_attached'; END IF;
  IF NEW.question_set_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.question_sets
    WHERE id = NEW.question_set_id AND deleted_at IS NULL AND status = 'published'
  ) THEN RAISE EXCEPTION 'only_published_sets_can_be_attached'; END IF;
  IF NEW.ucat_mock_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ucat_mocks
    WHERE id = NEW.ucat_mock_id AND deleted_at IS NULL AND status = 'published'
  ) THEN RAISE EXCEPTION 'only_published_mocks_can_be_attached'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_published_ucat_session_resource ON public.ucat_sessions_resources;
CREATE TRIGGER validate_published_ucat_session_resource
  BEFORE INSERT OR UPDATE OF question_stem_id, question_set_id, ucat_mock_id
  ON public.ucat_sessions_resources
  FOR EACH ROW EXECUTE FUNCTION public.validate_published_ucat_session_resource();

CREATE OR REPLACE FUNCTION public.validate_published_ucat_learning_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.block_type = 'question_stem' AND NOT EXISTS (
    SELECT 1 FROM public.question_stems
    WHERE id = NEW.question_stem_id AND deleted_at IS NULL AND status = 'published'
  ) THEN RAISE EXCEPTION 'only_published_stems_can_be_attached'; END IF;
  IF NEW.block_type = 'question' AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_questions question
    JOIN public.question_stems stem ON stem.id = question.question_stem_id
    WHERE question.id = NEW.question_id
      AND question.deleted_at IS NULL
      AND stem.deleted_at IS NULL
      AND stem.status = 'published'
  ) THEN RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_published_ucat_learning_block ON public.ucat_learning_module_blocks;
CREATE TRIGGER validate_published_ucat_learning_block
  BEFORE INSERT OR UPDATE OF block_type, question_stem_id, question_id
  ON public.ucat_learning_module_blocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_published_ucat_learning_block();

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_mocks
WITH (security_invoker = false)
AS
SELECT mock.id
FROM public.ucat_mocks mock
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE mock.deleted_at IS NULL
  AND mock.status = 'published'
  AND (
    (ctx.has_online_access AND mock.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.ucat_mock_id = mock.id
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_sets
WITH (security_invoker = false)
AS
SELECT question_set.id
FROM public.question_sets question_set
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE question_set.deleted_at IS NULL
  AND question_set.status = 'published'
  AND (
    (ctx.has_online_access AND question_set.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.question_set_id = question_set.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_sets_ucat_mocks member ON member.ucat_mock_id = resource.ucat_mock_id
      WHERE member.question_set_id = question_set.id
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_stems
WITH (security_invoker = false)
AS
SELECT stem.id
FROM public.question_stems stem
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND (
    (ctx.has_online_access AND stem.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_stems_question_sets member ON member.question_set_id = resource.question_set_id
      WHERE member.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_sets_ucat_mocks mock_member ON mock_member.ucat_mock_id = resource.ucat_mock_id
      JOIN public.question_stems_question_sets stem_member ON stem_member.question_set_id = mock_member.question_set_id
      WHERE stem_member.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks block
      JOIN public.vstudent_ucat_accessible_learning_modules module ON module.id = block.learning_module_id
      LEFT JOIN public.ucat_questions question ON question.id = block.question_id
      WHERE block.deleted_at IS NULL
        AND (
          block.question_stem_id = stem.id
          OR (question.deleted_at IS NULL AND question.question_stem_id = stem.id)
        )
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  stem.question_stem_category_id,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  (
    stem.status = 'published'
    AND stem.access_scope = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_sets parent ON parent.id = member.question_set_id
      WHERE member.question_stem_id = stem.id
        AND parent.deleted_at IS NULL
        AND parent.status = 'published'
    )
  ) AS is_available_for_practice
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id;

CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question.id,
      'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'time_burden_seconds', question.time_burden_seconds,
      'question_type', question.question_type,
      'answer_options', (
        SELECT json_agg(json_build_object(
          'id', option.id,
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'index', option.index,
          'is_answer', option.is_answer,
          'selection_count', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id = option.id AND attempt.is_submitted),
          'total_answered', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id IS NOT NULL AND attempt.is_submitted),
          'percentage', COALESCE(round(
            100.0 * (SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id = option.id AND attempt.is_submitted)
            / NULLIF((SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt WHERE attempt.question_id = question.id AND attempt.question_answer_option_id IS NOT NULL AND attempt.is_submitted), 0),
            1
          ), 0)
        ) ORDER BY option.index)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.deleted_at IS NULL
      )
    ) ORDER BY question.index)
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

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
  ) AS is_available_in_sets_library
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id;

CREATE VIEW public.vstudent_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  question_set.id,
  question_set.name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.created_at,
  question_set.updated_at,
  (
    SELECT json_agg(json_build_object(
      'stem_id', stem.id,
      'stem_text', stem.stem_text,
      'questions_meta', (
        SELECT json_agg(json_build_object('id', question.id, 'index', question.index) ORDER BY question.index)
        FROM public.ucat_questions question
        WHERE question.question_stem_id = member.question_stem_id
          AND question.deleted_at IS NULL
      )
    ) ORDER BY member.index)
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem ON stem.id = member.question_stem_id AND stem.deleted_at IS NULL
    JOIN public.vstudent_ucat_accessible_question_stems accessible_stem ON accessible_stem.id = stem.id
    WHERE member.question_set_id = question_set.id
  ) AS stems
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id;

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

CREATE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  mock.id,
  mock.name,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  (
    SELECT count(*)::INTEGER
    FROM public.question_sets_ucat_mocks member
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set ON accessible_set.id = member.question_set_id
    WHERE member.ucat_mock_id = mock.id
  ) AS set_count,
  EXISTS (
    SELECT 1
    FROM public.question_sets_ucat_mocks member
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set ON accessible_set.id = member.question_set_id
    JOIN public.question_sets question_set ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    WHERE member.ucat_mock_id = mock.id
      AND question_set.time_limit_seconds IS NOT NULL
      AND question_set.time_limit_seconds > 0
  ) AS has_timed_sets
FROM public.ucat_mocks mock
JOIN public.vstudent_ucat_accessible_mocks accessible ON accessible.id = mock.id;

CREATE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  mock.id,
  mock.name,
  mock.instructions_text,
  mock.created_at,
  mock.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question_set.id,
      'name', question_set.name,
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds
    ) ORDER BY member.index)
    FROM public.question_sets_ucat_mocks member
    JOIN public.question_sets question_set ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set ON accessible_set.id = question_set.id
    WHERE member.ucat_mock_id = mock.id
  ) AS sets
FROM public.ucat_mocks mock
JOIN public.vstudent_ucat_accessible_mocks accessible ON accessible.id = mock.id;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;
GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_question_stem(p_question_stem_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.vstudent_ucat_accessible_question_stems WHERE id = p_question_stem_id); $$;
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_question_set(p_question_set_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.vstudent_ucat_accessible_question_sets WHERE id = p_question_set_id); $$;
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_mock(p_ucat_mock_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.vstudent_ucat_accessible_mocks WHERE id = p_ucat_mock_id); $$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_stem(p_stem_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_sets parent ON parent.id = member.question_set_id
    WHERE member.question_stem_id = p_stem_id AND parent.deleted_at IS NULL
  ) OR EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE question_stem_id = p_stem_id)
    OR EXISTS (
      SELECT 1 FROM public.ucat_learning_module_blocks block
      LEFT JOIN public.ucat_questions question ON question.id = block.question_id
      WHERE block.deleted_at IS NULL AND (block.question_stem_id = p_stem_id OR question.question_stem_id = p_stem_id)
    )
  THEN RAISE EXCEPTION 'delete_blocked_by_dependency'; END IF;
  v_staff_id := public.current_tutor_id();
  UPDATE public.question_answer_options option SET deleted_at = NOW(), deleted_by = v_staff_id
  WHERE option.question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = p_stem_id);
  UPDATE public.ucat_questions SET deleted_at = NOW(), deleted_by = v_staff_id WHERE question_stem_id = p_stem_id;
  UPDATE public.question_stems SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id WHERE id = p_stem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_set(p_set_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.question_sets_ucat_mocks member
    JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id
    WHERE member.question_set_id = p_set_id AND parent.deleted_at IS NULL
  ) OR EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE question_set_id = p_set_id)
  THEN RAISE EXCEPTION 'delete_blocked_by_dependency'; END IF;
  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_mock(p_mock_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE ucat_mock_id = p_mock_id)
  THEN RAISE EXCEPTION 'delete_blocked_by_dependency'; END IF;
  UPDATE public.ucat_mocks
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_mock_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_stem(p_stem_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  UPDATE public.question_answer_options option SET deleted_at = NULL, deleted_by = NULL
  WHERE option.question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = p_stem_id);
  UPDATE public.ucat_questions SET deleted_at = NULL, deleted_by = NULL WHERE question_stem_id = p_stem_id;
  UPDATE public.question_stems
  SET deleted_at = NULL, deleted_by = NULL, status = 'draft', status_changed_at = NOW(),
      status_changed_by = v_staff_id, updated_by = v_staff_id
  WHERE id = p_stem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_set(p_set_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.question_sets
  SET deleted_at = NULL, deleted_by = NULL, status = 'draft', status_changed_at = NOW(),
      status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_mock(p_mock_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ucat_mocks
  SET deleted_at = NULL, deleted_by = NULL, status = 'draft', status_changed_at = NOW(),
      status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_mock_id;
END;
$$;

DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_generated;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_approved;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems;
CREATE VIEW public.vtutor_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns AS section_display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  (
    stem.status = 'published' AND stem.access_scope = 'public' AND NOT EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets pool_member
      JOIN public.question_sets pool_parent ON pool_parent.id = pool_member.question_set_id
      WHERE pool_member.question_stem_id = stem.id
        AND pool_parent.deleted_at IS NULL
        AND pool_parent.status = 'published'
    )
  ) AS is_available_in_question_pool,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
  status_staff.first_name AS status_changed_by_first_name,
  status_staff.last_name AS status_changed_by_last_name,
  stem.ai_generation_metadata,
  stem.source_channel,
  stem.tutor_source_note,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  stem.created_by,
  stem.updated_by,
  stem.deleted_at,
  stem.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  (SELECT COUNT(*)::INT FROM public.ucat_questions question WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL) AS question_count,
  (SELECT COALESCE(jsonb_agg(parent.name ORDER BY parent.updated_at DESC NULLS LAST, parent.id), '[]'::jsonb)
   FROM public.question_stems_question_sets member
   JOIN public.question_sets parent ON parent.id = member.question_set_id AND parent.deleted_at IS NULL
   WHERE member.question_stem_id = stem.id) AS set_names,
  (SELECT COALESCE(jsonb_agg(parent.id ORDER BY parent.updated_at DESC NULLS LAST, parent.id), '[]'::jsonb)
   FROM public.question_stems_question_sets member
   JOIN public.question_sets parent ON parent.id = member.question_set_id AND parent.deleted_at IS NULL
   WHERE member.question_stem_id = stem.id) AS set_ids,
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = stem.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = stem.updated_by
LEFT JOIN public.staff status_staff ON status_staff.id = stem.status_changed_by
WHERE public.is_ucat_tutor();

DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;
CREATE VIEW public.vtutor_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
  stem.ai_generation_metadata,
  stem.source_channel,
  stem.tutor_source_note,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  stem.created_by,
  stem.updated_by,
  stem.deleted_at,
  stem.deleted_by,
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues,
  (
    SELECT json_agg(
      json_build_object(
        'id', question.id,
        'question_text', question.question_text,
        'answer_explanation', question.answer_explanation,
        'index', question.index,
        'difficulty', question.difficulty,
        'time_burden_seconds', question.time_burden_seconds,
        'question_type', question.question_type,
        'source_channel', question.source_channel,
        'ai_generation_metadata', question.ai_generation_metadata,
        'tags', (
          SELECT COALESCE(json_agg(json_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name), '[]'::json)
          FROM public.questions_question_tags question_tag
          JOIN public.question_tags tag ON tag.id = question_tag.tag_id
          WHERE question_tag.question_id = question.id
        ),
        'answer_options', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', option.id,
              'answer_text', option.answer_text,
              'answer_explanation', option.answer_explanation,
              'index', option.index,
              'is_answer', option.is_answer
            ) ORDER BY option.index, option.id
          ), '[]'::json)
          FROM public.question_answer_options option
          WHERE option.question_id = question.id AND option.deleted_at IS NULL
        )
      ) ORDER BY question.index, question.id
    )
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

DROP VIEW IF EXISTS public.vtutor_ucat_mock_detail;
DROP VIEW IF EXISTS public.vtutor_ucat_question_set_detail;
DROP VIEW IF EXISTS public.vtutor_ucat_question_sets;
CREATE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  question_set.id,
  question_set.name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.status,
  question_set.access_scope,
  (
    question_set.status = 'published' AND question_set.access_scope = 'public' AND NOT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks pool_member
      JOIN public.ucat_mocks pool_parent ON pool_parent.id = pool_member.ucat_mock_id
      WHERE pool_member.question_set_id = question_set.id
        AND pool_parent.deleted_at IS NULL
        AND pool_parent.status = 'published'
    )
  ) AS is_available_in_sets_pool,
  question_set.status_changed_at,
  question_set.status_changed_by,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  question_set.created_by,
  question_set.updated_by,
  question_set.deleted_at,
  question_set.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::INT FROM public.question_stems_question_sets member WHERE member.question_set_id = question_set.id) AS stem_count,
  (
    SELECT COUNT(*)::INT
    FROM public.ucat_questions question
    JOIN public.question_stems_question_sets member ON member.question_stem_id = question.question_stem_id
    WHERE member.question_set_id = question_set.id AND question.deleted_at IS NULL
  ) AS question_count,
  (
    SELECT COALESCE(jsonb_agg(member.ucat_mock_id ORDER BY member.index NULLS LAST, member.ucat_mock_id), '[]'::jsonb)
    FROM public.question_sets_ucat_mocks member
    JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id AND parent.deleted_at IS NULL
    WHERE member.question_set_id = question_set.id
  ) AS ucat_mock_ids,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues
FROM public.question_sets question_set
LEFT JOIN public.staff created_staff ON created_staff.id = question_set.created_by
WHERE public.is_ucat_tutor();

CREATE VIEW public.vtutor_ucat_question_set_detail
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
  ) AS stems
FROM public.question_sets question_set
WHERE public.is_ucat_tutor();

DROP VIEW IF EXISTS public.vtutor_ucat_mocks;
CREATE VIEW public.vtutor_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  mock.id,
  mock.name,
  mock.status,
  mock.access_scope,
  mock.status_changed_at,
  mock.status_changed_by,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  mock.updated_by,
  mock.deleted_at,
  mock.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks member WHERE member.ucat_mock_id = mock.id) AS set_count,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues
FROM public.ucat_mocks mock
LEFT JOIN public.staff created_staff ON created_staff.id = mock.created_by
WHERE public.is_ucat_tutor();

CREATE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  mock.id,
  mock.name,
  mock.status,
  mock.access_scope,
  mock.status_changed_at,
  mock.status_changed_by,
  mock.instructions_text,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  mock.updated_by,
  mock.deleted_at,
  mock.deleted_by,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'id', question_set.id,
      'name', question_set.name,
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds,
      'sections', question_set.sections,
      'question_count', question_set.question_count,
      'status', question_set.status,
      'access_scope', question_set.access_scope
    ) ORDER BY member.index)
    FROM public.question_sets_ucat_mocks member
    JOIN public.vtutor_ucat_question_sets question_set ON question_set.id = member.question_set_id
    WHERE member.ucat_mock_id = mock.id
  ) AS sets
FROM public.ucat_mocks mock
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;
GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;
GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(
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
  v_issues JSONB;
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
    IF EXISTS (SELECT 1 FROM public.question_stems WHERE id = v_stem_id AND status = 'published') THEN
      v_issues := public.ucat_content_publication_issues('stem', v_stem_id);
      IF jsonb_array_length(v_issues) > 0 THEN
        RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(UUID[], UUID, public.ucat_access_scope) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(UUID[], UUID, public.ucat_access_scope) TO authenticated;

-- Parent attempt snapshots preserve names and ordering after catalogue withdrawal.
ALTER TABLE public.student_question_set_attempts
  ADD COLUMN content_snapshot JSONB;
ALTER TABLE public.student_ucat_mock_attempts
  ADD COLUMN content_snapshot JSONB;

CREATE OR REPLACE FUNCTION public.ucat_question_set_content_snapshot(p_set_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'id', question_set.id,
    'name', question_set.name,
    'description', question_set.description,
    'timeLimitSeconds', question_set.time_limit_seconds,
    'stemIds', COALESCE((
      SELECT jsonb_agg(member.question_stem_id ORDER BY member.index, member.question_stem_id)
      FROM public.question_stems_question_sets member
      WHERE member.question_set_id = question_set.id
    ), '[]'::jsonb)
  )
  FROM public.question_sets question_set
  WHERE question_set.id = p_set_id;
$$;

CREATE OR REPLACE FUNCTION public.ucat_mock_content_snapshot(p_mock_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'id', mock.id,
    'name', mock.name,
    'instructionsText', mock.instructions_text,
    'setIds', COALESCE((
      SELECT jsonb_agg(member.question_set_id ORDER BY member.index, member.question_set_id)
      FROM public.question_sets_ucat_mocks member
      WHERE member.ucat_mock_id = mock.id
    ), '[]'::jsonb)
  )
  FROM public.ucat_mocks mock
  WHERE mock.id = p_mock_id;
$$;

CREATE OR REPLACE FUNCTION public.capture_ucat_parent_attempt_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'student_question_set_attempts' THEN
      NEW.content_snapshot := COALESCE(NEW.content_snapshot, public.ucat_question_set_content_snapshot(NEW.question_set_id));
    ELSE
      NEW.content_snapshot := COALESCE(NEW.content_snapshot, public.ucat_mock_content_snapshot(NEW.ucat_mock_id));
    END IF;
    IF NEW.content_snapshot IS NULL THEN RAISE EXCEPTION 'parent_attempt_snapshot_not_found'; END IF;
  ELSE
    NEW.content_snapshot := OLD.content_snapshot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_ucat_set_attempt_content ON public.student_question_set_attempts;
CREATE TRIGGER capture_ucat_set_attempt_content
  BEFORE INSERT OR UPDATE OF content_snapshot, question_set_id
  ON public.student_question_set_attempts
  FOR EACH ROW EXECUTE FUNCTION public.capture_ucat_parent_attempt_content();

DROP TRIGGER IF EXISTS capture_ucat_mock_attempt_content ON public.student_ucat_mock_attempts;
CREATE TRIGGER capture_ucat_mock_attempt_content
  BEFORE INSERT OR UPDATE OF content_snapshot, ucat_mock_id
  ON public.student_ucat_mock_attempts
  FOR EACH ROW EXECUTE FUNCTION public.capture_ucat_parent_attempt_content();

UPDATE public.student_question_set_attempts attempt
SET content_snapshot = public.ucat_question_set_content_snapshot(attempt.question_set_id)
WHERE content_snapshot IS NULL;
UPDATE public.student_ucat_mock_attempts attempt
SET content_snapshot = public.ucat_mock_content_snapshot(attempt.ucat_mock_id)
WHERE content_snapshot IS NULL;

ALTER TABLE public.student_question_set_attempts
  ADD CONSTRAINT student_question_set_attempts_content_snapshot_required
  CHECK (content_snapshot IS NOT NULL) NOT VALID;
ALTER TABLE public.student_ucat_mock_attempts
  ADD CONSTRAINT student_ucat_mock_attempts_content_snapshot_required
  CHECK (content_snapshot IS NOT NULL) NOT VALID;

COMMENT ON COLUMN public.student_question_set_attempts.content_snapshot IS
  'Immutable set name and ordered stem IDs captured when the attempt starts.';
COMMENT ON COLUMN public.student_ucat_mock_attempts.content_snapshot IS
  'Immutable mock name and ordered set IDs captured when the attempt starts.';

-- A student's own history is entitlement-gated, never current-catalogue-gated.
CREATE OR REPLACE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.question_set_id,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken_seconds,
  attempt.student_ucat_mock_attempt_id,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.set_time_limit_seconds,
  attempt.set_time_limit_at_exam_speed_seconds,
  attempt.set_speed,
  attempt.student_set_speed,
  attempt.student_exam_speed,
  attempt.was_timed,
  attempt.content_snapshot
FROM public.student_question_set_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_mock_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.ucat_mock_id,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken,
  attempt.mock_time_limit_seconds,
  attempt.mock_time_limit_at_exam_speed_seconds,
  attempt.student_mock_speed,
  attempt.content_snapshot
FROM public.student_ucat_mock_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.student_question_set_attempt_id,
  attempt.student_practice_session_id,
  COALESCE(attempt.question_id, (attempt.content_snapshot #>> '{question,id}')::UUID) AS question_id,
  COALESCE(question.question_stem_id, (attempt.content_snapshot #>> '{stem,id}')::UUID) AS question_stem_id,
  COALESCE(question.index, (attempt.content_snapshot #>> '{question,index}')::INTEGER) AS question_index,
  COALESCE(question.question_text, attempt.content_snapshot #> '{question,questionText}') AS question_text,
  COALESCE(question.question_type, (attempt.content_snapshot #>> '{question,questionType}')::public.ucat_question_type) AS question_type,
  COALESCE(question.time_burden_seconds, (attempt.content_snapshot #>> '{question,timeBurdenSeconds}')::INTEGER) AS time_burden_seconds,
  COALESCE(stem.stem_text, attempt.content_snapshot #> '{stem,stemText}') AS stem_text,
  COALESCE(stem.question_stem_category_id, (attempt.content_snapshot #>> '{stem,categoryId}')::UUID) AS question_stem_category_id,
  COALESCE(category.name, attempt.content_snapshot #>> '{stem,categoryName}') AS category_name,
  COALESCE(section.id, (attempt.content_snapshot #>> '{stem,sectionId}')::UUID) AS ucat_section_id,
  COALESCE(section.name, attempt.content_snapshot #>> '{stem,sectionName}') AS section_name,
  COALESCE(section.section_number, (attempt.content_snapshot #>> '{stem,sectionNumber}')::INTEGER) AS section_number,
  attempt.question_answer_option_id,
  COALESCE(selected_option.answer_text, (
    SELECT option -> 'answerText'
    FROM jsonb_array_elements(COALESCE(attempt.content_snapshot -> 'answerOptions', '[]'::jsonb)) option
    WHERE option ->> 'id' = attempt.question_answer_option_id::TEXT
    LIMIT 1
  )) AS selected_answer_text,
  attempt.answer_snapshot,
  attempt.score,
  attempt.is_flagged,
  attempt.is_submitted,
  attempt.attempted_at,
  attempt.time_spent_seconds,
  attempt.student_question_speed,
  attempt.was_timed,
  attempt.mode,
  attempt.content_snapshot
FROM public.student_question_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access
LEFT JOIN public.ucat_questions question ON question.id = attempt.question_id
LEFT JOIN public.question_stems stem ON stem.id = question.question_stem_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_answer_options selected_option ON selected_option.id = attempt.question_answer_option_id;

GRANT SELECT ON public.vstudent_ucat_my_set_attempts TO authenticated;
GRANT SELECT ON public.vstudent_ucat_my_mock_attempts TO authenticated;
GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

CREATE VIEW public.vstudent_ucat_my_question_progress
WITH (security_invoker = true)
AS
WITH ranked_attempts AS (
  SELECT
    attempt.question_id,
    attempt.question_stem_id,
    attempt.question_type,
    attempt.ucat_section_id,
    attempt.question_stem_category_id,
    attempt.score,
    row_number() OVER (
      PARTITION BY attempt.question_id
      ORDER BY attempt.score DESC NULLS LAST, attempt.attempted_at DESC, attempt.id DESC
    ) AS question_rank
  FROM public.vstudent_ucat_my_question_attempts attempt
  WHERE attempt.is_submitted
), best_attempts AS (
  SELECT
    ranked.question_id,
    ranked.question_stem_id,
    ranked.question_type,
    ranked.ucat_section_id,
    ranked.question_stem_category_id,
    ranked.score,
    row_number() OVER (
      PARTITION BY ranked.ucat_section_id, ranked.question_stem_id
      ORDER BY ranked.question_id
    ) AS stem_question_rank
  FROM ranked_attempts ranked
  WHERE ranked.question_rank = 1
)
SELECT
  best.ucat_section_id AS section_id,
  best.question_stem_category_id AS category_id,
  COALESCE(sum(best.score), 0)::INTEGER AS correct_score,
  sum(CASE
    WHEN best.question_type = 'syllogism' THEN CASE WHEN best.stem_question_rank = 1 THEN 2 ELSE 0 END
    ELSE 1
  END)::INTEGER AS max_score
FROM best_attempts best
WHERE best.ucat_section_id IS NOT NULL
GROUP BY best.ucat_section_id, best.question_stem_category_id;

CREATE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH question_rows AS (
  SELECT
    question.id,
    question.question_stem_id,
    question.question_type,
    stem.section_id,
    stem.question_stem_category_id,
    row_number() OVER (
      PARTITION BY question.question_stem_id
      ORDER BY question.index NULLS LAST, question.id
    ) AS stem_question_index
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
  WHERE question.deleted_at IS NULL AND stem.deleted_at IS NULL
)
SELECT
  question_rows.section_id,
  question_rows.question_stem_category_id,
  sum(CASE
    WHEN question_rows.question_type = 'syllogism' AND question_rows.stem_question_index = 1 THEN 2
    WHEN question_rows.question_type = 'syllogism' THEN 0
    ELSE 1
  END)::INTEGER AS total_questions
FROM question_rows
GROUP BY question_rows.section_id, question_rows.question_stem_category_id;

GRANT SELECT ON public.vstudent_ucat_my_question_progress TO authenticated;
GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_image(p_stem_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_stem_id IS NOT NULL
    AND public.is_ucat_student()
    AND EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_question_stems stem
      WHERE stem.id = p_stem_id
    );
$$;

CREATE VIEW public.vstudent_ucat_learning_module_blocks
WITH (security_invoker = false)
AS
SELECT
  block.id,
  block.learning_module_id,
  block.block_type,
  block.index,
  block.require_completion_before_next,
  block.content,
  block.question_stem_id,
  block.question_id,
  block.file_id,
  block.skill_trainer_id,
  progress.completed_at AS block_completed_at,
  progress.manually_completed,
  progress.interaction_state
FROM public.ucat_learning_module_blocks block
JOIN public.vstudent_ucat_accessible_learning_modules accessible
  ON accessible.id = block.learning_module_id
JOIN public.ucat_learning_modules module ON module.id = block.learning_module_id
LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
LEFT JOIN public.ucat_questions question ON question.id = block.question_id
LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
LEFT JOIN public.ucat_skill_trainers trainer ON trainer.id = block.skill_trainer_id
LEFT JOIN public.ucat_student_learning_module_block_progress progress
  ON progress.learning_module_block_id = block.id
  AND progress.student_id = (SELECT student_id FROM public.vstudent_ucat_access_context)
WHERE block.deleted_at IS NULL
  AND module.deleted_at IS NULL
  AND module.kind = 'lesson'
  AND (
    block.block_type <> 'question_stem'
    OR (stem.id IS NOT NULL AND stem.deleted_at IS NULL AND stem.status = 'published')
  )
  AND (
    block.block_type <> 'question'
    OR (
      question.id IS NOT NULL
      AND question.deleted_at IS NULL
      AND question_stem.id IS NOT NULL
      AND question_stem.deleted_at IS NULL
      AND question_stem.status = 'published'
    )
  )
  AND (block.block_type <> 'skill_trainer' OR trainer.is_enabled = true);

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;

CREATE VIEW public.vstudent_ucat_progress_attempt_history
WITH (security_invoker = false)
AS
SELECT
  'set'::TEXT AS source,
  attempt.id,
  placement.section_id,
  section.name AS section_name,
  attempt.question_set_id AS resource_id,
  attempt.content_snapshot -> 'name' AS resource_name,
  false AS unlimited,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken_seconds,
  attempt.set_time_limit_seconds AS time_limit_seconds,
  attempt.student_set_speed,
  attempt.student_exam_speed,
  attempt.was_timed,
  null::INTEGER AS question_count,
  null::NUMERIC AS scaled_score_max
FROM public.student_question_set_attempts attempt
LEFT JOIN LATERAL (
  SELECT (question_attempt.content_snapshot #>> '{stem,sectionId}')::UUID AS section_id
  FROM public.student_question_attempts question_attempt
  WHERE question_attempt.student_question_set_attempt_id = attempt.id
  ORDER BY question_attempt.attempted_at, question_attempt.id
  LIMIT 1
) placement ON true
LEFT JOIN public.ucat_sections section ON section.id = placement.section_id
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
  AND attempt.student_ucat_mock_attempt_id IS NULL
UNION ALL
SELECT
  'practice'::TEXT,
  attempt.id,
  attempt.ucat_section_id,
  section.name,
  attempt.ucat_section_id,
  to_jsonb(section.name),
  attempt.unlimited,
  attempt.started_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  null::NUMERIC,
  extract(epoch FROM (attempt.completed_at - attempt.started_at))::INTEGER,
  null::INTEGER,
  null::NUMERIC,
  null::NUMERIC,
  false,
  attempt.question_count,
  null::NUMERIC
FROM public.student_practice_sessions attempt
JOIN public.ucat_sections section ON section.id = attempt.ucat_section_id
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
UNION ALL
SELECT
  'mock'::TEXT,
  attempt.id,
  null::UUID,
  null::TEXT,
  attempt.ucat_mock_id,
  attempt.content_snapshot -> 'name',
  false,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken,
  attempt.mock_time_limit_seconds,
  null::NUMERIC,
  attempt.student_mock_speed,
  (attempt.mock_time_limit_seconds IS NOT NULL AND attempt.mock_time_limit_seconds > 0),
  null::INTEGER,
  2700::NUMERIC
FROM public.student_ucat_mock_attempts attempt
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL;

CREATE VIEW public.vstudent_ucat_section_set_progress
WITH (security_invoker = false)
AS
SELECT
  placement.section_id,
  count(DISTINCT attempt.question_set_id)::INTEGER AS total_completed,
  count(DISTINCT attempt.question_set_id) FILTER (WHERE NOT attempt.was_timed)::INTEGER AS untimed_completed,
  count(DISTINCT attempt.question_set_id) FILTER (WHERE attempt.was_timed)::INTEGER AS timed_completed
FROM public.student_question_set_attempts attempt
JOIN LATERAL (
  SELECT (question_attempt.content_snapshot #>> '{stem,sectionId}')::UUID AS section_id
  FROM public.student_question_attempts question_attempt
  WHERE question_attempt.student_question_set_attempt_id = attempt.id
  ORDER BY question_attempt.attempted_at, question_attempt.id
  LIMIT 1
) placement ON true
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
GROUP BY placement.section_id;

GRANT SELECT ON public.vstudent_ucat_progress_attempt_history TO authenticated;
GRANT SELECT ON public.vstudent_ucat_section_set_progress TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ucat_public_content_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released BOOLEAN := false;
  v_content_type TEXT;
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_plural_body TEXT;
  v_action_url TEXT;
  v_action_label TEXT;
  v_aggregate_date DATE := (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE;
  v_created_by_staff_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'question_sets' THEN
    v_content_type := 'sets';
    v_notification_type := 'ucat.content.sets_released';
    v_title := 'New UCAT sets are available';
    v_body := 'A new question set has been released.';
    v_plural_body := ' new question sets have been released.';
    v_action_url := '/sets';
    v_action_label := 'View sets';
    v_released := NEW.status = 'published' AND NEW.access_scope = 'public' AND NEW.deleted_at IS NULL
      AND (TG_OP = 'INSERT' OR OLD.status <> 'published' OR OLD.access_scope <> 'public' OR OLD.deleted_at IS NOT NULL);
  ELSIF TG_TABLE_NAME = 'ucat_mocks' THEN
    v_content_type := 'mocks';
    v_notification_type := 'ucat.content.mocks_released';
    v_title := 'New UCAT mocks are available';
    v_body := 'A new mock exam has been released.';
    v_plural_body := ' new mock exams have been released.';
    v_action_url := '/mocks';
    v_action_label := 'View mocks';
    v_released := NEW.status = 'published' AND NEW.access_scope = 'public' AND NEW.deleted_at IS NULL
      AND (TG_OP = 'INSERT' OR OLD.status <> 'published' OR OLD.access_scope <> 'public' OR OLD.deleted_at IS NOT NULL);
  ELSIF TG_TABLE_NAME = 'ucat_learning_modules' THEN
    v_content_type := 'learning';
    v_notification_type := 'ucat.content.learning_released';
    v_title := 'New UCAT learning is available';
    v_body := 'A new learning module has been released.';
    v_plural_body := ' new learning modules have been released.';
    v_action_url := '/learn';
    v_action_label := 'Start learning';
    v_released := NEW.kind = 'lesson' AND NEW.is_private = false AND NEW.deleted_at IS NULL
      AND (TG_OP = 'INSERT' OR OLD.kind <> 'lesson' OR OLD.is_private = true OR OLD.deleted_at IS NOT NULL);
  END IF;
  IF NOT v_released THEN RETURN NEW; END IF;

  v_created_by_staff_id := COALESCE(NEW.updated_by, NEW.created_by);
  INSERT INTO public.notifications (
    student_id, notification_type, app_scope, title, body, action_url, metadata,
    dedupe_key, priority, created_by_staff_id
  )
  SELECT
    student.id, v_notification_type, 'ucat_web', v_title, v_body, v_action_url,
    jsonb_build_object(
      'content_type', v_content_type,
      'release_count', 1,
      'content_ids', jsonb_build_array(NEW.id::TEXT),
      'aggregate_date', v_aggregate_date::TEXT,
      'action_label', v_action_label
    ),
    'ucat:content-release:' || v_content_type || ':' || v_aggregate_date::TEXT || ':' || student.id::TEXT,
    'normal', v_created_by_staff_id
  FROM public.students student
  WHERE student.status = 'ACTIVE' AND student.user_id IS NOT NULL
  ON CONFLICT (dedupe_key) DO UPDATE
  SET
    title = EXCLUDED.title,
    body = CASE
      WHEN COALESCE((notifications.metadata ->> 'release_count')::INTEGER, 1) + 1 = 1 THEN v_body
      ELSE (COALESCE((notifications.metadata ->> 'release_count')::INTEGER, 1) + 1)::TEXT || v_plural_body
    END,
    metadata = jsonb_set(
      jsonb_set(
        EXCLUDED.metadata,
        '{release_count}',
        to_jsonb(COALESCE((notifications.metadata ->> 'release_count')::INTEGER, 1) + 1)
      ),
      '{content_ids}',
      COALESCE(notifications.metadata -> 'content_ids', '[]'::jsonb) || jsonb_build_array(NEW.id::TEXT)
    ),
    read_at = NULL,
    resolved_at = NULL,
    created_at = NOW(),
    updated_at = NOW(),
    created_by_staff_id = EXCLUDED.created_by_staff_id
  WHERE NOT (COALESCE(notifications.metadata -> 'content_ids', '[]'::jsonb) @> jsonb_build_array(NEW.id::TEXT));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_public_content_release() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_ucat_question_set_release
AFTER INSERT OR UPDATE OF status, access_scope, deleted_at ON public.question_sets
FOR EACH ROW EXECUTE FUNCTION public.notify_ucat_public_content_release();
CREATE TRIGGER notify_ucat_mock_release
AFTER INSERT OR UPDATE OF status, access_scope, deleted_at ON public.ucat_mocks
FOR EACH ROW EXECUTE FUNCTION public.notify_ucat_public_content_release();
