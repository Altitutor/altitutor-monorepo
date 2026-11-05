-- Both batch RPCs are authenticated admin-web entrypoints. SECURITY DEFINER
-- is needed for private recalculation helpers; authorize before enabling batch
-- mode or parsing input. Keep pg_temp last for legacy helper resolution.
CREATE OR REPLACE FUNCTION public.batch_update_topic_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  update_item jsonb;
  v_affected_topic_ids UUID[];
  v_affected_groups RECORD;
BEGIN
  IF NOT coalesce((SELECT public.is_adminstaff_active()), false) THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;

  -- Set session variable to prevent triggers from firing
  PERFORM set_config('app.in_batch_update', 'true', true);

  -- Collect affected topic IDs for code recalculation
  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_topic_ids
  FROM jsonb_array_elements(updates) AS item;

  -- First pass: Set all indices to negative values to avoid conflicts
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.topics
    SET index = -((update_item->>'index')::int + 1000)
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  -- Second pass: Set explicit indices from drag-and-drop
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.topics
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  -- Reset session variable
  PERFORM set_config('app.in_batch_update', 'false', true);

  -- Third pass: Recalculate all affected sibling groups to ensure sequential order
  -- Collect all unique (subject_id, parent_id) groups that were affected
  FOR v_affected_groups IN
    SELECT DISTINCT subject_id, parent_id
    FROM public.topics
    WHERE id = ANY(v_affected_topic_ids)
  LOOP
    PERFORM public.recalculate_topic_indices_for_siblings(
      v_affected_groups.subject_id,
      v_affected_groups.parent_id
    );
  END LOOP;

  -- Fourth pass: Recalculate codes for all affected topics and their descendants
  IF v_affected_topic_ids IS NOT NULL AND array_length(v_affected_topic_ids, 1) > 0 THEN
    FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
    LOOP
      PERFORM public.recalculate_topic_code_and_descendants((update_item->>'id')::uuid);
      PERFORM public.recalculate_topic_file_codes_for_topic_and_descendants((update_item->>'id')::uuid);
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_update_topic_file_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  update_item jsonb;
  v_affected_file_ids UUID[];
  v_affected_groups RECORD;
  v_counter INTEGER := 0;
BEGIN
  IF NOT coalesce((SELECT public.is_adminstaff_active()), false) THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.in_batch_update', 'true', true);

  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_file_ids
  FROM jsonb_array_elements(updates) AS item;

  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    v_counter := v_counter + 1;
    UPDATE public.topics_files
    SET index = -(10000 + v_counter)
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.topics_files
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  PERFORM set_config('app.in_batch_update', 'false', true);

  FOR v_affected_groups IN
    SELECT DISTINCT topic_id, type, is_solutions
    FROM public.topics_files
    WHERE id = ANY(v_affected_file_ids)
  LOOP
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      v_affected_groups.topic_id,
      v_affected_groups.type,
      v_affected_groups.is_solutions
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_update_topic_indices(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.batch_update_topic_file_indices(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_topic_indices(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_topic_file_indices(jsonb) TO authenticated;
