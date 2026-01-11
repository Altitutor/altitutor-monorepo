-- Fix batch_update_topic_file_indices to use unique negative values
-- This prevents duplicate key violations when multiple files have the same target index
-- Migration: 20260112000000_fix_batch_update_topic_file_indices

CREATE OR REPLACE FUNCTION batch_update_topic_file_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
  v_affected_file_ids UUID[];
  v_affected_groups RECORD;
  v_counter INTEGER := 0;
BEGIN
  -- Set session variable to prevent triggers from firing
  PERFORM set_config('app.in_batch_update', 'true', true);
  
  -- Collect affected file IDs
  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_file_ids
  FROM jsonb_array_elements(updates) AS item;
  
  -- First pass: Set all indices to unique negative values to avoid conflicts
  -- Use a counter to ensure each file gets a unique negative value
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    v_counter := v_counter + 1;
    -- Use a large negative offset plus counter to ensure uniqueness
    -- This avoids conflicts even when multiple files have the same target index
    UPDATE topics_files
    SET index = -((update_item->>'index')::int + 10000 + v_counter)
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  -- Second pass: Set explicit indices from drag-and-drop
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE topics_files
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;
  
  -- Reset session variable
  PERFORM set_config('app.in_batch_update', 'false', true);
  
  -- Third pass: Recalculate all affected sibling groups to ensure sequential order
  -- Collect all unique (topic_id, type, is_solutions) groups that were affected
  FOR v_affected_groups IN
    SELECT DISTINCT topic_id, type, is_solutions
    FROM topics_files
    WHERE id = ANY(v_affected_file_ids)
  LOOP
    PERFORM recalculate_topic_file_indices_for_siblings(
      v_affected_groups.topic_id,
      v_affected_groups.type,
      v_affected_groups.is_solutions
    );
  END LOOP;
END;
$$;
