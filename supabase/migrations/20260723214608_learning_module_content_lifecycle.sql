-- Migration: learning_module_content_lifecycle
-- Why: lessons use the same status + access_scope model as stems/sets/mocks.
-- Folders keep inert published/public values and are not managed via lifecycle RPCs.

ALTER TABLE public.ucat_learning_modules
  ADD COLUMN IF NOT EXISTS status public.ucat_content_status,
  ADD COLUMN IF NOT EXISTS access_scope public.ucat_access_scope,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

UPDATE public.ucat_learning_modules
SET
  status = CASE
    WHEN kind = 'folder' THEN 'published'::public.ucat_content_status
    WHEN is_private = false THEN 'published'::public.ucat_content_status
    ELSE 'published'::public.ucat_content_status
  END,
  access_scope = CASE
    WHEN kind = 'folder' THEN 'public'::public.ucat_access_scope
    WHEN is_private = false THEN 'public'::public.ucat_access_scope
    ELSE 'private'::public.ucat_access_scope
  END,
  status_changed_at = COALESCE(updated_at, created_at, NOW()),
  status_changed_by = COALESCE(updated_by, created_by),
  published_at = CASE
    WHEN kind = 'folder' OR is_private = false OR is_private = true
      THEN COALESCE(updated_at, created_at, NOW())
  END,
  published_by = COALESCE(updated_by, created_by)
WHERE status IS NULL OR access_scope IS NULL;

ALTER TABLE public.ucat_learning_modules
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN access_scope SET DEFAULT 'public',
  ALTER COLUMN access_scope SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ucat_learning_modules_status_access
  ON public.ucat_learning_modules(status, access_scope)
  WHERE deleted_at IS NULL AND kind = 'lesson';

-- Drop objects that still reference is_private before the column drop.
DROP TRIGGER IF EXISTS notify_ucat_learning_release ON public.ucat_learning_modules;
DROP TRIGGER IF EXISTS validate_public_learning_module_assessment_refs ON public.ucat_learning_modules;
DROP FUNCTION IF EXISTS public.validate_public_learning_module_assessment_refs();

-- Same output shape (id only) so dependents keep working while we retarget the predicate.
CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_learning_modules
WITH (security_invoker = false)
AS
SELECT lm.id
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND lm.status = 'published'
  AND (
    (ctx.has_online_access AND lm.access_scope = 'public')
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources usr
      WHERE usr.ucat_learning_module_id = lm.id
    )
  );

DROP VIEW IF EXISTS public.vstudent_ucat_learning_modules;
DROP VIEW IF EXISTS public.vtutor_ucat_learning_modules;

ALTER TABLE public.ucat_learning_modules
  DROP COLUMN IF EXISTS is_private;

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.status,
  lm.access_scope,
  lm.status_changed_at,
  lm.status_changed_by,
  lm.published_at,
  lm.published_by,
  lm.created_at,
  lm.updated_at,
  lm.created_by,
  lm.updated_by,
  lm.deleted_at,
  lm.deleted_by,
  s.name AS section_name,
  s.section_number,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_modules child
    WHERE child.parent_ucat_learning_module_id = lm.id
      AND child.deleted_at IS NULL
  ) AS child_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_module_blocks block
    WHERE block.learning_module_id = lm.id
      AND block.deleted_at IS NULL
  ) AS block_count,
  lm.study_plan_priority,
  lm.icon_key,
  lm.estimated_minutes
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_learning_modules TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.status,
  lm.access_scope,
  s.name AS section_name,
  s.section_number,
  progress.started_at,
  progress.completion_percent,
  progress.completed_at,
  lm.study_plan_priority,
  lm.icon_key,
  lm.estimated_minutes
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context context
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress progress
  ON progress.learning_module_id = lm.id
  AND progress.student_id = context.student_id
LEFT JOIN public.vstudent_ucat_accessible_learning_modules accessible_module
  ON accessible_module.id = lm.id
WHERE lm.deleted_at IS NULL
  AND context.has_online_access
  AND (
    lm.kind = 'folder'
    OR accessible_module.id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      JOIN public.vstudent_ucat_accessible_learning_modules accessible_child
        ON accessible_child.id = child.id
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
    )
  );

GRANT SELECT ON public.vstudent_ucat_learning_modules TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_learning_module(p_learning_module_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_has_online BOOLEAN;
BEGIN
  SELECT ctx.student_id, ctx.has_online_access
  INTO v_student_id, v_has_online
  FROM public.vstudent_ucat_access_context ctx
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.ucat_learning_modules lm
    WHERE lm.id = p_learning_module_id
      AND lm.deleted_at IS NULL
      AND lm.kind = 'lesson'
      AND lm.status = 'published'
      AND (
        (v_has_online AND lm.access_scope = 'public')
        OR EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          WHERE usr.ucat_learning_module_id = lm.id
        )
      )
  );
END;
$$;

DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_learning_module(
  UUID,
  public.ucat_learning_module_kind,
  TEXT,
  TEXT,
  UUID,
  UUID,
  INTEGER,
  BOOLEAN,
  TEXT,
  INTEGER
);

CREATE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_access_scope public.ucat_access_scope DEFAULT 'public',
  p_icon_key TEXT DEFAULT 'book-open',
  p_estimated_minutes INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_module_id UUID;
  v_index INTEGER;
  v_access public.ucat_access_scope;
  v_status public.ucat_content_status;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_estimated_minutes IS NOT NULL
    AND p_estimated_minutes NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'invalid_learning_module_estimated_minutes';
  END IF;

  v_staff_id := public.current_tutor_id();
  v_access := COALESCE(p_access_scope, 'public'::public.ucat_access_scope);

  IF p_kind = 'folder' THEN
    v_status := 'published'::public.ucat_content_status;
    v_access := 'public'::public.ucat_access_scope;
  ELSE
    v_status := 'draft'::public.ucat_content_status;
  END IF;

  BEGIN
    IF p_module_id IS NULL THEN
      IF p_parent_id IS NULL THEN
        SELECT COALESCE(MAX(index), -1) + 1 INTO v_index
        FROM public.ucat_learning_modules
        WHERE parent_ucat_learning_module_id IS NULL
          AND deleted_at IS NULL;
      ELSE
        SELECT COALESCE(MAX(index), -1) + 1 INTO v_index
        FROM public.ucat_learning_modules
        WHERE parent_ucat_learning_module_id = p_parent_id
          AND deleted_at IS NULL;
      END IF;

      INSERT INTO public.ucat_learning_modules (
        kind, title, description, ucat_section_id, parent_ucat_learning_module_id,
        index, status, access_scope, icon_key, estimated_minutes,
        status_changed_at, status_changed_by,
        published_at, published_by,
        created_by, updated_by
      )
      VALUES (
        p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
        v_index, v_status, v_access, COALESCE(p_icon_key, 'book-open'), p_estimated_minutes,
        NOW(), v_staff_id,
        CASE WHEN p_kind = 'folder' THEN NOW() ELSE NULL END,
        CASE WHEN p_kind = 'folder' THEN v_staff_id ELSE NULL END,
        v_staff_id, v_staff_id
      )
      RETURNING id INTO v_module_id;
    ELSE
      UPDATE public.ucat_learning_modules
      SET
        kind = p_kind,
        title = p_title,
        description = p_description,
        ucat_section_id = p_ucat_section_id,
        parent_ucat_learning_module_id = p_parent_id,
        index = COALESCE(p_index, index),
        access_scope = CASE
          WHEN p_kind = 'folder' THEN 'public'::public.ucat_access_scope
          ELSE v_access
        END,
        status = CASE
          WHEN p_kind = 'folder' THEN 'published'::public.ucat_content_status
          ELSE status
        END,
        icon_key = COALESCE(p_icon_key, icon_key),
        estimated_minutes = p_estimated_minutes,
        updated_by = v_staff_id,
        updated_at = NOW()
      WHERE id = p_module_id AND deleted_at IS NULL
      RETURNING id INTO v_module_id;

      IF v_module_id IS NULL THEN
        RAISE EXCEPTION 'learning_module_not_found';
      END IF;
    END IF;
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'invalid_learning_module_icon';
  END;

  RETURN v_module_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_learning_module(
  UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER,
  public.ucat_access_scope, TEXT, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_learning_module(
  UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER,
  public.ucat_access_scope, TEXT, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_published_ucat_learning_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.ucat_content_status;
  v_is_pending BOOLEAN;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT module.status
  INTO v_status
  FROM public.ucat_learning_modules module
  WHERE module.id = NEW.learning_module_id
    AND module.deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  v_is_pending := NEW.content->'pendingGeneratedStem' = 'true'::jsonb;

  IF NEW.block_type = 'question_stem' THEN
    IF NEW.question_stem_id IS NULL THEN
      IF v_status = 'published' OR NOT v_is_pending THEN
        RAISE EXCEPTION 'only_published_stems_can_be_attached';
      END IF;
      RETURN NEW;
    END IF;

    IF v_status <> 'published' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.question_stems stem
        WHERE stem.id = NEW.question_stem_id
          AND stem.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'only_published_stems_can_be_attached';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.question_stems stem
      WHERE stem.id = NEW.question_stem_id
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
    ) THEN
      RAISE EXCEPTION 'only_published_stems_can_be_attached';
    END IF;
  END IF;

  IF NEW.block_type = 'question' THEN
    IF NEW.question_id IS NULL THEN
      IF v_status = 'published' OR NOT v_is_pending THEN
        RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
      END IF;
      RETURN NEW;
    END IF;

    IF v_status <> 'published' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.ucat_questions question
        JOIN public.question_stems stem ON stem.id = question.question_stem_id
        WHERE question.id = NEW.question_id
          AND question.deleted_at IS NULL
          AND stem.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      JOIN public.question_stems stem ON stem.id = question.question_stem_id
      WHERE question.id = NEW.question_id
        AND question.deleted_at IS NULL
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
    ) THEN
      RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_published_learning_module_assessment_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.kind <> 'lesson' OR NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ucat_learning_module_blocks block
    LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
    LEFT JOIN public.ucat_questions question ON question.id = block.question_id
    LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
    WHERE block.learning_module_id = NEW.id
      AND block.deleted_at IS NULL
      AND (
        (
          block.block_type = 'question_stem'
          AND (
            block.content->'pendingGeneratedStem' = 'true'::jsonb
            OR block.question_stem_id IS NULL
            OR stem.id IS NULL
            OR stem.deleted_at IS NOT NULL
            OR stem.status IS DISTINCT FROM 'published'
          )
        )
        OR (
          block.block_type = 'question'
          AND (
            block.content->'pendingGeneratedStem' = 'true'::jsonb
            OR block.question_id IS NULL
            OR question.id IS NULL
            OR question.deleted_at IS NOT NULL
            OR question_stem.id IS NULL
            OR question_stem.deleted_at IS NOT NULL
            OR question_stem.status IS DISTINCT FROM 'published'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'published_lessons_require_published_assessment_blocks';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_public_learning_module_assessment_refs ON public.ucat_learning_modules;
DROP FUNCTION IF EXISTS public.validate_public_learning_module_assessment_refs();

DROP TRIGGER IF EXISTS validate_published_learning_module_assessment_refs ON public.ucat_learning_modules;
CREATE TRIGGER validate_published_learning_module_assessment_refs
  BEFORE INSERT OR UPDATE OF status, deleted_at, kind
  ON public.ucat_learning_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_published_learning_module_assessment_refs();

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

  ELSIF p_content_type = 'lesson' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules
      WHERE id = p_content_id
        AND deleted_at IS NULL
        AND kind = 'lesson'
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Lesson not found.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks block
      LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
      LEFT JOIN public.ucat_questions question ON question.id = block.question_id
      LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
      WHERE block.learning_module_id = p_content_id
        AND block.deleted_at IS NULL
        AND (
          (
            block.block_type = 'question_stem'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::jsonb
              OR block.question_stem_id IS NULL
              OR stem.id IS NULL
              OR stem.deleted_at IS NOT NULL
              OR stem.status IS DISTINCT FROM 'published'
            )
          )
          OR (
            block.block_type = 'question'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::jsonb
              OR block.question_id IS NULL
              OR question.id IS NULL
              OR question.deleted_at IS NOT NULL
              OR question_stem.id IS NULL
              OR question_stem.deleted_at IS NOT NULL
              OR question_stem.status IS DISTINCT FROM 'published'
            )
          )
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'unpublished_assessment',
        'message', 'Every assessment block must reference published question content with no pending placeholders.'
      ));
    END IF;

  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  RETURN v_issues;
END;
$$;

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
  ELSIF p_content_type = 'lesson' THEN
    UPDATE public.ucat_learning_modules
    SET access_scope = p_access_scope, updated_by = v_staff_id, updated_at = NOW()
    WHERE id = p_content_id
      AND deleted_at IS NULL
      AND kind = 'lesson';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ucat_content_not_found';
  END IF;
END;
$$;

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
  ELSIF p_content_type = 'lesson' THEN
    SELECT status INTO v_current
    FROM public.ucat_learning_modules
    WHERE id = p_content_id AND deleted_at IS NULL AND kind = 'lesson';
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
          JOIN public.ucat_learning_modules module ON module.id = block.learning_module_id
          LEFT JOIN public.ucat_questions question ON question.id = block.question_id
          WHERE block.deleted_at IS NULL
            AND module.deleted_at IS NULL
            AND module.status = 'published'
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
    ELSIF p_content_type = 'lesson' THEN
      IF EXISTS (
        SELECT 1 FROM public.ucat_sessions_resources WHERE ucat_learning_module_id = p_content_id
      ) THEN
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
  ELSIF p_content_type = 'mock' THEN
    UPDATE public.ucat_mocks
    SET status = p_status, status_changed_at = NOW(), status_changed_by = v_staff_id,
        published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
        published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
        updated_by = v_staff_id
    WHERE id = p_content_id;
  ELSE
    UPDATE public.ucat_learning_modules
    SET status = p_status, status_changed_at = NOW(), status_changed_by = v_staff_id,
        published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
        published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
        updated_by = v_staff_id,
        updated_at = NOW()
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
        'This question is used by published lesson “%s”. Remove the linked block before moving it out of Published.',
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
      AND module.status = 'published'
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

  ELSIF p_content_type = 'lesson' THEN
    SELECT v_blockers || COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'session_attachment',
      'message', format(
        'This lesson is attached to session “%s”. Remove it from the session before moving it out of Published.',
        COALESCE(session.short_name, session.long_name, 'Untitled session')
      ),
      'entity_type', 'session',
      'entity_id', session.id,
      'entity_name', COALESCE(session.short_name, session.long_name, 'Untitled session')
    )), '[]'::jsonb)
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

CREATE OR REPLACE FUNCTION public.tutor_ucat_soft_delete_learning_module(p_module_id UUID)
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

  IF EXISTS (
    SELECT 1 FROM public.ucat_sessions_resources WHERE ucat_learning_module_id = p_module_id
  ) THEN
    RAISE EXCEPTION 'status_blocked_by_attachment';
  END IF;

  v_staff_id := public.current_tutor_id();

  UPDATE public.ucat_learning_modules
  SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id, updated_at = NOW()
  WHERE id = p_module_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_learning_module(p_module_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_kind public.ucat_learning_module_kind;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_staff_id := public.current_tutor_id();

  SELECT kind INTO v_kind
  FROM public.ucat_learning_modules
  WHERE id = p_module_id;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  UPDATE public.ucat_learning_modules
  SET
    deleted_at = NULL,
    deleted_by = NULL,
    status = CASE
      WHEN v_kind = 'folder' THEN 'published'::public.ucat_content_status
      ELSE 'draft'::public.ucat_content_status
    END,
    access_scope = CASE
      WHEN v_kind = 'folder' THEN 'public'::public.ucat_access_scope
      ELSE access_scope
    END,
    status_changed_at = NOW(),
    status_changed_by = v_staff_id,
    updated_by = v_staff_id,
    updated_at = NOW()
  WHERE id = p_module_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_restore_learning_module(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_learning_module(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_learning_module(UUID) TO service_role;

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
    PERFORM public.tutor_ucat_soft_delete_learning_module(v_module_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_delete_learning_modules(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_learning_modules(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_learning_modules(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_ucat_content_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_type TEXT;
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_plural_body TEXT;
  v_action_url TEXT;
  v_action_label TEXT;
  v_aggregate_date DATE := (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE;
  v_created_by_staff_id UUID;
  v_released BOOLEAN := false;
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
    v_released := NEW.kind = 'lesson'
      AND NEW.status = 'published'
      AND NEW.access_scope = 'public'
      AND NEW.deleted_at IS NULL
      AND (
        TG_OP = 'INSERT'
        OR OLD.kind <> 'lesson'
        OR OLD.status <> 'published'
        OR OLD.access_scope <> 'public'
        OR OLD.deleted_at IS NOT NULL
      );
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

DROP TRIGGER IF EXISTS notify_ucat_learning_release ON public.ucat_learning_modules;
CREATE TRIGGER notify_ucat_learning_release
AFTER INSERT OR UPDATE OF kind, status, access_scope, deleted_at
ON public.ucat_learning_modules
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_content_release();
