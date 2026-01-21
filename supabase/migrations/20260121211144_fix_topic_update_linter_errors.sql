-- Migration: Fix linter errors in topic update functions
-- Description:
--   - Replace temp table usage with array-based approach to satisfy PostgreSQL linter
--   - Maintains exact same functionality and performance characteristics
--   - Fixes static analysis errors without changing behavior

-- ========================
-- PART 1: FIX recalculate_topic_indices_for_siblings
-- ========================

CREATE OR REPLACE FUNCTION recalculate_topic_indices_for_siblings(
  p_subject_id UUID,
  p_parent_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_topic_ids UUID[];
  v_new_indices INTEGER[];
  v_in_batch_update BOOLEAN;
BEGIN
  -- Check if we're already in a batch update
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;
  
  -- If not in batch update, set the flag to prevent trigger recursion
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'true', true);
  END IF;
  
  -- Collect all sibling IDs into array, ordered by current index (preserve relative order)
  SELECT 
    ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
  INTO 
    v_topic_ids
  FROM topics
  WHERE subject_id = p_subject_id
    AND (p_parent_id IS NULL AND parent_id IS NULL OR parent_id = p_parent_id);
  
  -- If no siblings, return early
  IF v_topic_ids IS NULL OR array_length(v_topic_ids, 1) = 0 THEN
    IF NOT v_in_batch_update THEN
      PERFORM set_config('app.in_batch_update', 'false', true);
    END IF;
    RETURN;
  END IF;
  
  -- Calculate new sequential indices (1, 2, 3, ...)
  v_new_indices := ARRAY(
    SELECT generate_series(1, array_length(v_topic_ids, 1))
  );
  
  -- First pass: Set all indices to negative values to avoid unique constraint violations
  -- Use bulk UPDATE with unnest for performance
  UPDATE topics
  SET index = -(sub.new_index + 1000)
  FROM (
    SELECT 
      unnest(v_topic_ids) AS id,
      unnest(v_new_indices) AS new_index
  ) sub
  WHERE topics.id = sub.id;
  
  -- Second pass: Set actual sequential indices starting from 1
  UPDATE topics
  SET index = sub.new_index
  FROM (
    SELECT 
      unnest(v_topic_ids) AS id,
      unnest(v_new_indices) AS new_index
  ) sub
  WHERE topics.id = sub.id;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

-- ========================
-- PART 2: FIX recalculate_topic_file_indices_for_siblings
-- ========================

CREATE OR REPLACE FUNCTION recalculate_topic_file_indices_for_siblings(
  p_topic_id UUID,
  p_type resource_type,
  p_is_solutions BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_file_ids UUID[];
  v_new_indices INTEGER[];
  v_in_batch_update BOOLEAN;
BEGIN
  -- Check if we're already in a batch update
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;
  
  -- If not in batch update, set the flag to prevent trigger recursion
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'true', true);
  END IF;
  
  -- Collect all sibling file IDs into array, ordered by current index (preserve relative order)
  SELECT 
    ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
  INTO 
    v_file_ids
  FROM topics_files
  WHERE topic_id = p_topic_id
    AND type = p_type
    AND is_solutions = p_is_solutions;
  
  -- If no siblings, return early
  IF v_file_ids IS NULL OR array_length(v_file_ids, 1) = 0 THEN
    IF NOT v_in_batch_update THEN
      PERFORM set_config('app.in_batch_update', 'false', true);
    END IF;
    RETURN;
  END IF;
  
  -- Calculate new sequential indices (1, 2, 3, ...)
  v_new_indices := ARRAY(
    SELECT generate_series(1, array_length(v_file_ids, 1))
  );
  
  -- First pass: Set all indices to negative values to avoid unique constraint violations
  -- Use bulk UPDATE with unnest for performance
  UPDATE topics_files
  SET index = -(sub.new_index + 1000)
  FROM (
    SELECT 
      unnest(v_file_ids) AS id,
      unnest(v_new_indices) AS new_index
  ) sub
  WHERE topics_files.id = sub.id;
  
  -- Second pass: Set actual sequential indices starting from 1
  UPDATE topics_files
  SET index = sub.new_index
  FROM (
    SELECT 
      unnest(v_file_ids) AS id,
      unnest(v_new_indices) AS new_index
  ) sub
  WHERE topics_files.id = sub.id;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;
