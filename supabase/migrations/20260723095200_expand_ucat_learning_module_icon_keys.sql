-- Migration: expand_ucat_learning_module_icon_keys
-- Why: grow curated Lucide allowlist so each lesson can use a distinct icon.

ALTER TABLE public.ucat_learning_modules
  DROP CONSTRAINT IF EXISTS ucat_learning_modules_icon_key_check;

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
    'file-text',
    'graduation-cap',
    'school',
    'library',
    'pencil',
    'pen-line',
    'highlighter',
    'notebook',
    'notebook-pen',
    'clipboard-list',
    'clipboard-check',
    'list-checks',
    'bookmark',
    'star',
    'clock-3',
    'timer',
    'hourglass',
    'gauge',
    'zap',
    'flame',
    'rocket',
    'layers',
    'layout-grid',
    'boxes',
    'shapes',
    'puzzle',
    'git-branch',
    'git-fork',
    'workflow',
    'network',
    'split',
    'combine',
    'repeat',
    'refresh-cw',
    'infinity',
    'link-2',
    'filter',
    'waypoints',
    'route',
    'map',
    'milestone',
    'flag',
    'focus',
    'crosshair',
    'aperture',
    'radar',
    'orbit',
    'arrow-left-right',
    'eye',
    'search',
    'scan',
    'scan-search',
    'quote',
    'message-square',
    'message-square-text',
    'messages-square',
    'info',
    'help-circle',
    'percent',
    'sigma',
    'pi',
    'binary',
    'hash',
    'braces',
    'ruler',
    'table-2',
    'grid-3x3',
    'bar-chart-3',
    'line-chart',
    'pie-chart',
    'triangle',
    'circle-dot',
    'square',
    'hexagon',
    'scale',
    'users',
    'user-check',
    'user-round-check',
    'heart-handshake',
    'shield-check',
    'hand',
    'pointer',
    'footprints',
    'trophy',
    'award',
    'medal',
    'key-round',
    'atom',
    'dna',
    'microscope',
    'flask-conical',
    'stethoscope',
    'activity',
    'heart-pulse',
    'cpu',
    'play-circle',
    'video',
    'headphones',
    'wand-2'
  ));

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_learning_module(
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
    'book-open',
    'lightbulb',
    'target',
    'brain',
    'calculator',
    'compass',
    'sparkles',
    'file-text',
    'graduation-cap',
    'school',
    'library',
    'pencil',
    'pen-line',
    'highlighter',
    'notebook',
    'notebook-pen',
    'clipboard-list',
    'clipboard-check',
    'list-checks',
    'bookmark',
    'star',
    'clock-3',
    'timer',
    'hourglass',
    'gauge',
    'zap',
    'flame',
    'rocket',
    'layers',
    'layout-grid',
    'boxes',
    'shapes',
    'puzzle',
    'git-branch',
    'git-fork',
    'workflow',
    'network',
    'split',
    'combine',
    'repeat',
    'refresh-cw',
    'infinity',
    'link-2',
    'filter',
    'waypoints',
    'route',
    'map',
    'milestone',
    'flag',
    'focus',
    'crosshair',
    'aperture',
    'radar',
    'orbit',
    'arrow-left-right',
    'eye',
    'search',
    'scan',
    'scan-search',
    'quote',
    'message-square',
    'message-square-text',
    'messages-square',
    'info',
    'help-circle',
    'percent',
    'sigma',
    'pi',
    'binary',
    'hash',
    'braces',
    'ruler',
    'table-2',
    'grid-3x3',
    'bar-chart-3',
    'line-chart',
    'pie-chart',
    'triangle',
    'circle-dot',
    'square',
    'hexagon',
    'scale',
    'users',
    'user-check',
    'user-round-check',
    'heart-handshake',
    'shield-check',
    'hand',
    'pointer',
    'footprints',
    'trophy',
    'award',
    'medal',
    'key-round',
    'atom',
    'dna',
    'microscope',
    'flask-conical',
    'stethoscope',
    'activity',
    'heart-pulse',
    'cpu',
    'play-circle',
    'video',
    'headphones',
    'wand-2'
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
