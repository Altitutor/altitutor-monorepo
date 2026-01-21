-- Migration: Fix topic update timeout by optimizing trigger functions
-- Description:
--   - Optimize recalculate_topic_code_and_descendants to use bulk updates and disable triggers
--   - Optimize recalculate_topic_indices_for_siblings to use bulk updates instead of loops
--   - Prevent trigger recursion during bulk operations

-- ========================
-- PART 1: OPTIMIZE recalculate_topic_code_and_descendants
-- ========================

-- Replace with optimized version that disables triggers during bulk updates
CREATE OR REPLACE FUNCTION recalculate_topic_code_and_descendants(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_descendant_ids UUID[];
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
  
  -- Collect all descendant IDs (including the topic itself)
  WITH RECURSIVE descendants AS (
    SELECT id FROM topics WHERE id = p_topic_id
    UNION ALL
    SELECT t.id FROM topics t
    JOIN descendants d ON t.parent_id = d.id
  )
  SELECT ARRAY_AGG(id) INTO v_descendant_ids
  FROM descendants;
  
  -- Bulk update all codes at once using a single UPDATE statement
  -- This avoids triggering AFTER UPDATE triggers for each individual update
  IF v_descendant_ids IS NOT NULL AND array_length(v_descendant_ids, 1) > 0 THEN
    UPDATE topics
    SET code = calculate_topic_code(id)
    WHERE id = ANY(v_descendant_ids);
  END IF;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

-- ========================
-- PART 2: OPTIMIZE recalculate_topic_indices_for_siblings
-- ========================

-- Replace with optimized version that uses bulk updates
CREATE OR REPLACE FUNCTION recalculate_topic_indices_for_siblings(
  p_subject_id UUID,
  p_parent_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  
  -- Collect all sibling IDs ordered by current index (preserve relative order)
  -- Store in a temporary table with original order preserved
  CREATE TEMP TABLE IF NOT EXISTS temp_topic_reorder (
    id UUID PRIMARY KEY,
    original_index INTEGER,
    original_created_at TIMESTAMPTZ,
    new_index INTEGER
  ) ON COMMIT DROP;
  
  INSERT INTO temp_topic_reorder (id, original_index, original_created_at)
  SELECT id, index, created_at
  FROM topics
  WHERE subject_id = p_subject_id
    AND (p_parent_id IS NULL AND parent_id IS NULL OR parent_id = p_parent_id)
  ORDER BY index ASC, created_at ASC;
  
  -- If no siblings, return early
  IF NOT EXISTS (SELECT 1 FROM temp_topic_reorder) THEN
    IF NOT v_in_batch_update THEN
      PERFORM set_config('app.in_batch_update', 'false', true);
    END IF;
    RETURN;
  END IF;
  
  -- Calculate new sequential indices using a subquery
  UPDATE temp_topic_reorder t
  SET new_index = sub.new_index
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY original_index ASC, original_created_at ASC) AS new_index
    FROM temp_topic_reorder
  ) sub
  WHERE t.id = sub.id;
  
  -- First pass: Set all indices to negative values to avoid unique constraint violations
  UPDATE topics
  SET index = -(temp.new_index + 1000)
  FROM temp_topic_reorder temp
  WHERE topics.id = temp.id;
  
  -- Second pass: Set actual sequential indices starting from 1
  UPDATE topics
  SET index = temp.new_index
  FROM temp_topic_reorder temp
  WHERE topics.id = temp.id;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

-- ========================
-- PART 3: OPTIMIZE recalculate_topic_file_indices_for_siblings
-- ========================

-- Replace with optimized version that uses bulk updates
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
  
  -- Collect all sibling file IDs ordered by current index (preserve relative order)
  -- Store in a temporary table with original order preserved
  CREATE TEMP TABLE IF NOT EXISTS temp_file_reorder (
    id UUID PRIMARY KEY,
    original_index INTEGER,
    original_created_at TIMESTAMPTZ,
    new_index INTEGER
  ) ON COMMIT DROP;
  
  INSERT INTO temp_file_reorder (id, original_index, original_created_at)
  SELECT id, index, created_at
  FROM topics_files
  WHERE topic_id = p_topic_id
    AND type = p_type
    AND is_solutions = p_is_solutions
  ORDER BY index ASC, created_at ASC;
  
  -- If no siblings, return early
  IF NOT EXISTS (SELECT 1 FROM temp_file_reorder) THEN
    IF NOT v_in_batch_update THEN
      PERFORM set_config('app.in_batch_update', 'false', true);
    END IF;
    RETURN;
  END IF;
  
  -- Calculate new sequential indices using a subquery
  UPDATE temp_file_reorder t
  SET new_index = sub.new_index
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY original_index ASC, original_created_at ASC) AS new_index
    FROM temp_file_reorder
  ) sub
  WHERE t.id = sub.id;
  
  -- First pass: Set all indices to negative values to avoid unique constraint violations
  UPDATE topics_files
  SET index = -(temp.new_index + 1000)
  FROM temp_file_reorder temp
  WHERE topics_files.id = temp.id;
  
  -- Second pass: Set actual sequential indices starting from 1
  UPDATE topics_files
  SET index = temp.new_index
  FROM temp_file_reorder temp
  WHERE topics_files.id = temp.id;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

-- ========================
-- PART 4: OPTIMIZE recalculate_topic_file_codes_for_topic
-- ========================

-- Replace with optimized version that disables triggers during bulk updates
CREATE OR REPLACE FUNCTION recalculate_topic_file_codes_for_topic(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  
  -- Bulk update all file codes at once
  UPDATE topics_files
  SET code = calculate_topic_file_code(id)
  WHERE topic_id = p_topic_id;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

-- ========================
-- PART 5: OPTIMIZE recalculate_topic_file_codes_for_topic_and_descendants
-- ========================

-- Replace with optimized version that disables triggers during bulk updates
CREATE OR REPLACE FUNCTION recalculate_topic_file_codes_for_topic_and_descendants(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_descendant_ids UUID[];
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
  
  -- Collect all descendant topic IDs (including the topic itself)
  WITH RECURSIVE descendants AS (
    SELECT id FROM topics WHERE id = p_topic_id
    UNION ALL
    SELECT t.id FROM topics t
    JOIN descendants d ON t.parent_id = d.id
  )
  SELECT ARRAY_AGG(id) INTO v_descendant_ids
  FROM descendants;
  
  -- Bulk update all file codes at once
  IF v_descendant_ids IS NOT NULL AND array_length(v_descendant_ids, 1) > 0 THEN
    UPDATE topics_files
    SET code = calculate_topic_file_code(id)
    WHERE topic_id = ANY(v_descendant_ids);
  END IF;
  
  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;
