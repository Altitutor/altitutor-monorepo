-- Reorder UCAT learning modules without violating sibling index uniqueness.

CREATE OR REPLACE FUNCTION public.tutor_ucat_reorder_learning_modules(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_temp_base INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF EXISTS (
    WITH parsed AS (
      SELECT (item->>'id')::UUID AS id
      FROM jsonb_array_elements(p_items) WITH ORDINALITY AS input(item, ordinality)
      WHERE item ? 'id' AND item ? 'index'
    )
    SELECT 1
    FROM parsed tmp
    LEFT JOIN public.ucat_learning_modules lm
      ON lm.id = tmp.id AND lm.deleted_at IS NULL
    WHERE lm.id IS NULL
  ) THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  SELECT COALESCE(MAX(index), 0) + 100000
  INTO v_temp_base
  FROM public.ucat_learning_modules;

  WITH parsed AS (
    SELECT
      (item->>'id')::UUID AS id,
      ROW_NUMBER() OVER (ORDER BY ordinality)::INTEGER AS temp_index
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS input(item, ordinality)
    WHERE item ? 'id' AND item ? 'index'
  )
  UPDATE public.ucat_learning_modules lm
  SET
    index = v_temp_base + tmp.temp_index,
    updated_by = v_staff_id,
    updated_at = NOW()
  FROM parsed tmp
  WHERE lm.id = tmp.id
    AND lm.deleted_at IS NULL;

  WITH parsed AS (
    SELECT
      (item->>'id')::UUID AS id,
      GREATEST((item->>'index')::INTEGER, 0) AS final_index
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS input(item, ordinality)
    WHERE item ? 'id' AND item ? 'index'
  )
  UPDATE public.ucat_learning_modules lm
  SET
    index = tmp.final_index,
    updated_by = v_staff_id,
    updated_at = NOW()
  FROM parsed tmp
  WHERE lm.id = tmp.id
    AND lm.deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_reorder_learning_modules(JSONB) TO authenticated;
