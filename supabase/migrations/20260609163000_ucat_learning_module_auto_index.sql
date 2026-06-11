-- Auto-assign sibling index on learning module create to avoid unique index violations.

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_is_private BOOLEAN DEFAULT true,
  p_display_mode public.ucat_learning_module_display_mode DEFAULT 'stepped'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_module_id UUID;
  v_display_mode public.ucat_learning_module_display_mode;
  v_index INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_kind = 'folder' THEN
    v_display_mode := NULL;
  ELSE
    v_display_mode := COALESCE(p_display_mode, 'stepped'::public.ucat_learning_module_display_mode);
  END IF;

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
      index, is_private, display_mode, created_by, updated_by
    )
    VALUES (
      p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
      v_index, COALESCE(p_is_private, true), v_display_mode, v_staff_id, v_staff_id
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
      display_mode = v_display_mode,
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
