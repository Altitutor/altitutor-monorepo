-- UCAT learning modules: remove the display-mode concept.
-- Lessons now always render as a vertical scroll of blocks.

DROP VIEW IF EXISTS public.vstudent_ucat_learning_modules;
DROP VIEW IF EXISTS public.vtutor_ucat_learning_modules;

DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_learning_module(
  UUID,
  public.ucat_learning_module_kind,
  TEXT,
  TEXT,
  UUID,
  UUID,
  INTEGER,
  BOOLEAN,
  public.ucat_learning_module_display_mode
);

ALTER TABLE public.ucat_learning_modules
  DROP CONSTRAINT IF EXISTS ucat_learning_modules_kind_display_mode;

ALTER TABLE public.ucat_learning_modules
  DROP COLUMN IF EXISTS display_mode;

DROP TYPE IF EXISTS public.ucat_learning_module_display_mode;

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.*,
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
    FROM public.ucat_learning_module_blocks b
    WHERE b.learning_module_id = lm.id
      AND b.deleted_at IS NULL
  ) AS block_count
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
  p.started_at,
  p.completion_percent,
  p.completed_at
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress p
  ON p.learning_module_id = lm.id
  AND p.student_id = (SELECT public.current_student_id())
WHERE lm.deleted_at IS NULL
  AND public.is_ucat_online_student()
  AND (
    lm.kind = 'folder'
    OR public.can_student_access_ucat_learning_module(lm.id)
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
        AND public.can_student_access_ucat_learning_module(child.id)
    )
  );

GRANT SELECT ON public.vstudent_ucat_learning_modules TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_is_private BOOLEAN DEFAULT true
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
      index, is_private, created_by, updated_by
    )
    VALUES (
      p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
      v_index, COALESCE(p_is_private, true), v_staff_id, v_staff_id
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

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_learning_module(
  UUID,
  public.ucat_learning_module_kind,
  TEXT,
  TEXT,
  UUID,
  UUID,
  INTEGER,
  BOOLEAN
) TO authenticated;
