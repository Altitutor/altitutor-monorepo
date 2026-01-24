-- Migration: Guard topic descendant recalculation trigger during batch updates
-- Description:
--   - Prevent recursive trigger calls during bulk code/index recalculations
--   - Avoid statement timeouts when updating parent_id

CREATE OR REPLACE FUNCTION trigger_recalculate_descendants_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_in_batch_update BOOLEAN;
BEGIN
  -- Skip trigger during batch updates to prevent recursion
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;

  IF v_in_batch_update THEN
    RETURN NEW;
  END IF;

  -- Check if index or parent_id changed
  IF (OLD.index IS DISTINCT FROM NEW.index) OR (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    -- Recalculate codes for all descendants
    PERFORM recalculate_topic_code_and_descendants(NEW.id);

    -- Recalculate file codes for this topic and all descendants
    PERFORM recalculate_topic_file_codes_for_topic_and_descendants(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
