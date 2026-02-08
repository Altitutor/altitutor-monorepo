-- Migration: Fix topic parent update index calculation
-- Description:
--   - Add BEFORE UPDATE trigger to recalculate index when parent_id changes
--   - Prevents unique constraint violations by clearing old index before constraint check
--   - Uses same logic as BEFORE INSERT trigger to calculate new index

-- ========================
-- PART 1: CREATE BEFORE UPDATE TRIGGER FUNCTION
-- ========================

-- Function to recalculate index when parent_id changes on UPDATE
-- This runs BEFORE the unique constraint check, preventing violations
CREATE OR REPLACE FUNCTION trigger_auto_calculate_topic_index_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_index INTEGER;
  v_parent_changed BOOLEAN;
BEGIN
  -- Check if parent_id changed
  v_parent_changed := (OLD.parent_id IS DISTINCT FROM NEW.parent_id);
  
  -- If parent changed, we MUST recalculate the index to avoid unique constraint violations
  -- The old index might conflict with existing topics in the new parent group
  IF v_parent_changed THEN
    -- Always clear index when parent changes - we'll recalculate it below
    -- This prevents the old index from conflicting with the unique constraint
    NEW.index := NULL;
  END IF;
  
  -- If index is NULL (either cleared above or not set), calculate it
  IF NEW.index IS NULL THEN
    SELECT COALESCE(MAX(index), 0) INTO v_max_index
    FROM topics
    WHERE subject_id = NEW.subject_id
      AND (
        (parent_id IS NULL AND NEW.parent_id IS NULL) OR
        (parent_id = NEW.parent_id)
      )
      -- Exclude the current topic from the max calculation
      AND id != NEW.id;
    
    NEW.index := v_max_index + 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- PART 2: CREATE TRIGGER
-- ========================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_calculate_topic_index_on_update ON topics;

-- Create BEFORE UPDATE trigger
-- This must run BEFORE the unique constraint check
-- Named with "auto_" prefix to ensure it runs before code calculation triggers
CREATE TRIGGER trigger_auto_calculate_topic_index_on_update
  BEFORE UPDATE ON topics
  FOR EACH ROW
  WHEN (NEW.parent_id IS DISTINCT FROM OLD.parent_id)
  EXECUTE FUNCTION trigger_auto_calculate_topic_index_on_update();
