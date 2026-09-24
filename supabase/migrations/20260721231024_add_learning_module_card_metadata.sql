-- Student-facing learning module cards need a tutor-selected visual and a
-- concise duration estimate. These values are presentation metadata, not
-- derived progress, so they live on the module itself.
ALTER TABLE public.ucat_learning_modules
  ADD COLUMN icon_key TEXT NOT NULL DEFAULT 'book-open',
  ADD COLUMN estimated_minutes INTEGER;

ALTER TABLE public.ucat_learning_modules
  ADD CONSTRAINT ucat_learning_modules_icon_key_check
  CHECK (icon_key IN (
    'book-open',
    'lightbulb',
    'target',
    'brain',
    'calculator',
    'compass',
    'sparkles',
    'file-text'
  )),
  ADD CONSTRAINT ucat_learning_modules_estimated_minutes_check
  CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 600);

COMMENT ON COLUMN public.ucat_learning_modules.icon_key IS
  'Curated Lucide icon key used on student learning-module cards.';
COMMENT ON COLUMN public.ucat_learning_modules.estimated_minutes IS
  'Tutor-authored estimate of the minutes needed to complete a lesson.';

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
  lm.is_private,
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
  lm.is_private,
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

DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_learning_module(
  UUID,
  public.ucat_learning_module_kind,
  TEXT,
  TEXT,
  UUID,
  UUID,
  INTEGER,
  BOOLEAN
);

CREATE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_is_private BOOLEAN DEFAULT true,
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
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_icon_key NOT IN (
    'book-open', 'lightbulb', 'target', 'brain', 'calculator', 'compass',
    'sparkles', 'file-text'
  ) THEN
    RAISE EXCEPTION 'invalid_learning_module_icon';
  END IF;

  IF p_estimated_minutes IS NOT NULL
    AND p_estimated_minutes NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'invalid_learning_module_estimated_minutes';
  END IF;

  v_staff_id := public.current_tutor_id();

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
      index, is_private, icon_key, estimated_minutes, created_by, updated_by
    )
    VALUES (
      p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
      v_index, COALESCE(p_is_private, true), p_icon_key, p_estimated_minutes,
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
      is_private = COALESCE(p_is_private, is_private),
      icon_key = p_icon_key,
      estimated_minutes = p_estimated_minutes,
      updated_by = v_staff_id,
      updated_at = NOW()
    WHERE id = p_module_id AND deleted_at IS NULL
    RETURNING id INTO v_module_id;

    IF v_module_id IS NULL THEN
      RAISE EXCEPTION 'learning_module_not_found';
    END IF;
  END IF;

  RETURN v_module_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_learning_module(
  UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER,
  BOOLEAN, TEXT, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_learning_module(
  UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER,
  BOOLEAN, TEXT, INTEGER
) TO authenticated;
