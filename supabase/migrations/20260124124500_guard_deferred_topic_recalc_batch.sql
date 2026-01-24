-- Migration: Guard deferred topic recalc with batch flag
-- Description:
--   - Prevent recursive deferred recalculation loops by setting batch flag

CREATE OR REPLACE FUNCTION trigger_process_deferred_topic_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_group RECORD;
  v_in_batch_update BOOLEAN;
BEGIN
  -- Check if we're in a batch update
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;

  -- Skip during batch updates
  IF v_in_batch_update THEN
    RETURN NULL;
  END IF;

  -- Mark this statement as a batch update to avoid recursive triggers
  PERFORM set_config('app.in_batch_update', 'true', true);

  -- Process all deferred recalculations if table exists and has data
  -- Wrap in exception handler in case table doesn't exist
  BEGIN
    FOR v_group IN 
      SELECT DISTINCT subject_id, parent_id 
      FROM pg_temp.deferred_topic_recalc
    LOOP
      PERFORM recalculate_topic_indices_for_siblings(v_group.subject_id, v_group.parent_id);
    END LOOP;
    
    -- Clear the temp table
    TRUNCATE pg_temp.deferred_topic_recalc;
  EXCEPTION 
    WHEN undefined_table THEN
      -- Table doesn't exist, nothing to process
      NULL;
    WHEN OTHERS THEN
      -- Other errors, ignore
      NULL;
  END;

  -- Reset batch flag
  PERFORM set_config('app.in_batch_update', 'false', true);

  RETURN NULL;
END;
$$;
