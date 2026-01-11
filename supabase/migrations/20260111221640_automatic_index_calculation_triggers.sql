-- Migration: Automatic index calculation with triggers
-- Description:
--   - Automatically calculates indices for topics and topic files when NULL
--   - Automatically recalculates sibling indices to fill gaps when topics/files are moved or deleted
--   - Supports explicit indices from drag-and-drop reordering
--   - Ensures indices are always sequential (1, 2, 3...) with no gaps

-- ========================
-- PART 1: HELPER FUNCTIONS FOR TOPICS
-- ========================

-- Function to recalculate indices for all siblings of a topic group
-- Ensures indices are sequential starting from 1
-- Uses two-pass approach to avoid unique constraint violations
CREATE OR REPLACE FUNCTION recalculate_topic_indices_for_siblings(
  p_subject_id UUID,
  p_parent_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_topic RECORD;
  v_new_index INTEGER := 1;
  v_topic_ids UUID[];
BEGIN
  -- Collect all sibling IDs ordered by current index (preserve relative order)
  SELECT ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
  INTO v_topic_ids
  FROM topics
  WHERE subject_id = p_subject_id
    AND (p_parent_id IS NULL AND parent_id IS NULL OR parent_id = p_parent_id);
  
  -- If no siblings, return early
  IF v_topic_ids IS NULL OR array_length(v_topic_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- First pass: Set all indices to negative values to avoid conflicts
  FOR v_topic IN
    SELECT unnest(v_topic_ids) AS id
  LOOP
    UPDATE topics
    SET index = -(v_new_index + 1000)
    WHERE id = v_topic.id;
    
    v_new_index := v_new_index + 1;
  END LOOP;
  
  -- Second pass: Set actual sequential indices starting from 1
  v_new_index := 1;
  FOR v_topic IN
    SELECT unnest(v_topic_ids) AS id
  LOOP
    UPDATE topics
    SET index = v_new_index
    WHERE id = v_topic.id;
    
    v_new_index := v_new_index + 1;
  END LOOP;
END;
$$;

-- ========================
-- PART 2: HELPER FUNCTIONS FOR TOPIC FILES
-- ========================

-- Function to recalculate indices for all topic files of a specific type and solutions status
-- Ensures indices are sequential starting from 1
-- Uses two-pass approach to avoid unique constraint violations
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
  v_file RECORD;
  v_new_index INTEGER := 1;
  v_file_ids UUID[];
BEGIN
  -- Collect all sibling file IDs ordered by current index (preserve relative order)
  SELECT ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
  INTO v_file_ids
  FROM topics_files
  WHERE topic_id = p_topic_id
    AND type = p_type
    AND is_solutions = p_is_solutions;
  
  -- If no siblings, return early
  IF v_file_ids IS NULL OR array_length(v_file_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- First pass: Set all indices to negative values to avoid conflicts
  FOR v_file IN
    SELECT unnest(v_file_ids) AS id
  LOOP
    UPDATE topics_files
    SET index = -(v_new_index + 1000)
    WHERE id = v_file.id;
    
    v_new_index := v_new_index + 1;
  END LOOP;
  
  -- Second pass: Set actual sequential indices starting from 1
  v_new_index := 1;
  FOR v_file IN
    SELECT unnest(v_file_ids) AS id
  LOOP
    UPDATE topics_files
    SET index = v_new_index
    WHERE id = v_file.id;
    
    v_new_index := v_new_index + 1;
  END LOOP;
END;
$$;

-- ========================
-- PART 3: TRIGGER FUNCTIONS FOR TOPICS
-- ========================

-- BEFORE INSERT: Auto-calculate index if NULL
-- This must run BEFORE the code calculation trigger so code can use the calculated index
-- Named with "auto_" prefix to ensure it runs before "trigger_calculate_topic_code_on_insert"
CREATE OR REPLACE FUNCTION trigger_auto_calculate_topic_index_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_index INTEGER;
BEGIN
  -- Only calculate if index is NULL (explicit indices from drag-and-drop will be provided)
  IF NEW.index IS NULL THEN
    SELECT COALESCE(MAX(index), 0) INTO v_max_index
    FROM topics
    WHERE subject_id = NEW.subject_id
      AND (
        (parent_id IS NULL AND NEW.parent_id IS NULL) OR
        (parent_id = NEW.parent_id)
      );
    
    NEW.index := v_max_index + 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- AFTER UPDATE (ROW): Collect affected groups for deferred recalculation
-- This avoids conflicts when multiple topics are updated in the same statement
CREATE OR REPLACE FUNCTION trigger_recalculate_topic_siblings_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_changed BOOLEAN;
  v_in_batch_update BOOLEAN;
BEGIN
  -- Check if we're in a batch update (set by batch_update function)
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;
  
  -- Skip trigger during batch updates (batch_update handles recalculation)
  IF v_in_batch_update THEN
    RETURN NEW;
  END IF;
  
  v_parent_changed := (OLD.parent_id IS DISTINCT FROM NEW.parent_id);
  
  -- Only collect affected groups if parent changed
  IF v_parent_changed THEN
    -- Create temp table to store affected groups (if it doesn't exist)
    -- Use a unique constraint that handles NULL parent_id correctly
    CREATE TEMP TABLE IF NOT EXISTS deferred_topic_recalc (
      subject_id UUID NOT NULL,
      parent_id UUID,
      UNIQUE (subject_id, parent_id)
    ) ON COMMIT DROP;
    
    -- Insert old parent group
    INSERT INTO deferred_topic_recalc (subject_id, parent_id)
    VALUES (OLD.subject_id, OLD.parent_id)
    ON CONFLICT (subject_id, parent_id) DO NOTHING;
    
    -- Insert new parent group
    INSERT INTO deferred_topic_recalc (subject_id, parent_id)
    VALUES (NEW.subject_id, NEW.parent_id)
    ON CONFLICT (subject_id, parent_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- AFTER UPDATE (STATEMENT): Process deferred recalculations
-- This runs once per UPDATE statement, avoiding conflicts
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
  
  RETURN NULL;
END;
$$;

-- AFTER DELETE: Recalculate siblings to fill gap
CREATE OR REPLACE FUNCTION trigger_recalculate_topic_siblings_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalculate siblings to fill the gap left by deleted topic
  PERFORM recalculate_topic_indices_for_siblings(OLD.subject_id, OLD.parent_id);
  
  RETURN OLD;
END;
$$;

-- ========================
-- PART 4: TRIGGER FUNCTIONS FOR TOPIC FILES
-- ========================

-- BEFORE INSERT: Auto-calculate index if NULL
-- Named with "auto_" prefix to ensure it runs BEFORE "trigger_calculate_topic_file_code_on_insert"
CREATE OR REPLACE FUNCTION trigger_auto_calculate_topic_file_index_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_index INTEGER;
BEGIN
  -- Only calculate if index is NULL (explicit indices from drag-and-drop will be provided)
  IF NEW.index IS NULL THEN
    SELECT COALESCE(MAX(index), 0) INTO v_max_index
    FROM topics_files
    WHERE topic_id = NEW.topic_id
      AND type = NEW.type
      AND is_solutions = NEW.is_solutions;
    
    NEW.index := v_max_index + 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- AFTER UPDATE: Recalculate siblings when topic, type, or solutions status changes
-- Uses session variable to prevent trigger recursion during batch updates
CREATE OR REPLACE FUNCTION trigger_recalculate_topic_file_siblings_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_topic_changed BOOLEAN;
  v_type_changed BOOLEAN;
  v_solutions_changed BOOLEAN;
  v_in_batch_update BOOLEAN;
BEGIN
  -- Check if we're in a batch update (set by batch_update function)
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;
  
  -- Skip trigger during batch updates (batch_update handles recalculation)
  IF v_in_batch_update THEN
    RETURN NEW;
  END IF;
  
  v_topic_changed := (OLD.topic_id IS DISTINCT FROM NEW.topic_id);
  v_type_changed := (OLD.type IS DISTINCT FROM NEW.type);
  v_solutions_changed := (OLD.is_solutions IS DISTINCT FROM NEW.is_solutions);
  
  -- Only recalculate if grouping fields changed (to fill gaps)
  IF v_topic_changed OR v_type_changed OR v_solutions_changed THEN
    -- Recalculate old group (to fill gap)
    PERFORM recalculate_topic_file_indices_for_siblings(
      OLD.topic_id,
      OLD.type,
      OLD.is_solutions
    );
    
    -- Recalculate new group (to include moved file sequentially)
    PERFORM recalculate_topic_file_indices_for_siblings(
      NEW.topic_id,
      NEW.type,
      NEW.is_solutions
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- AFTER DELETE: Recalculate siblings to fill gap
CREATE OR REPLACE FUNCTION trigger_recalculate_topic_file_siblings_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalculate siblings to fill the gap left by deleted file
  PERFORM recalculate_topic_file_indices_for_siblings(
    OLD.topic_id,
    OLD.type,
    OLD.is_solutions
  );
  
  RETURN OLD;
END;
$$;

-- ========================
-- PART 5: CREATE TRIGGERS FOR TOPICS
-- ========================

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_auto_calculate_topic_index_on_insert ON topics;
DROP TRIGGER IF EXISTS trigger_recalculate_topic_siblings_after_update ON topics;
DROP TRIGGER IF EXISTS trigger_recalculate_topic_siblings_after_delete ON topics;

-- BEFORE INSERT trigger
-- Named with "auto_" prefix to ensure it runs BEFORE "trigger_calculate_topic_code_on_insert"
-- PostgreSQL executes BEFORE triggers in alphabetical order by trigger name
CREATE TRIGGER trigger_auto_calculate_topic_index_on_insert
  BEFORE INSERT ON topics
  FOR EACH ROW
  WHEN (NEW.index IS NULL)
  EXECUTE FUNCTION trigger_auto_calculate_topic_index_on_insert();

-- AFTER UPDATE trigger (ROW): Collect affected groups
CREATE TRIGGER trigger_recalculate_topic_siblings_after_update
  AFTER UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_topic_siblings_after_update();

-- AFTER UPDATE trigger (STATEMENT): Process deferred recalculations
CREATE TRIGGER trigger_process_deferred_topic_recalc_after_update
  AFTER UPDATE ON topics
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_process_deferred_topic_recalc();

-- AFTER DELETE trigger
CREATE TRIGGER trigger_recalculate_topic_siblings_after_delete
  AFTER DELETE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_topic_siblings_after_delete();

-- ========================
-- PART 6: CREATE TRIGGERS FOR TOPIC FILES
-- ========================

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_auto_calculate_topic_file_index_on_insert ON topics_files;
DROP TRIGGER IF EXISTS trigger_recalculate_topic_file_siblings_after_update ON topics_files;
DROP TRIGGER IF EXISTS trigger_recalculate_topic_file_siblings_after_delete ON topics_files;

-- BEFORE INSERT trigger
-- Named with "auto_" prefix to ensure it runs BEFORE "trigger_calculate_topic_file_code_on_insert"
CREATE TRIGGER trigger_auto_calculate_topic_file_index_on_insert
  BEFORE INSERT ON topics_files
  FOR EACH ROW
  WHEN (NEW.index IS NULL)
  EXECUTE FUNCTION trigger_auto_calculate_topic_file_index_on_insert();

-- AFTER UPDATE trigger
CREATE TRIGGER trigger_recalculate_topic_file_siblings_after_update
  AFTER UPDATE ON topics_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_topic_file_siblings_after_update();

-- AFTER DELETE trigger
CREATE TRIGGER trigger_recalculate_topic_file_siblings_after_delete
  AFTER DELETE ON topics_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_topic_file_siblings_after_delete();

-- ========================
-- PART 7: UPDATE BATCH UPDATE FUNCTIONS
-- ========================

-- Update batch_update_topic_indices to work with triggers
-- Uses session variable to prevent trigger recursion
CREATE OR REPLACE FUNCTION batch_update_topic_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
  v_affected_topic_ids UUID[];
  v_affected_groups RECORD;
BEGIN
  -- Set session variable to prevent triggers from firing
  PERFORM set_config('app.in_batch_update', 'true', true);
  
  -- Collect affected topic IDs for code recalculation
  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_topic_ids
  FROM jsonb_array_elements(updates) AS item;
  
  -- First pass: Set all indices to negative values to avoid conflicts
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE topics
    SET index = -((update_item->>'index')::int + 1000)
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  -- Second pass: Set explicit indices from drag-and-drop
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE topics
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;
  
  -- Reset session variable
  PERFORM set_config('app.in_batch_update', 'false', true);
  
  -- Third pass: Recalculate all affected sibling groups to ensure sequential order
  -- Collect all unique (subject_id, parent_id) groups that were affected
  FOR v_affected_groups IN
    SELECT DISTINCT subject_id, parent_id
    FROM topics
    WHERE id = ANY(v_affected_topic_ids)
  LOOP
    PERFORM recalculate_topic_indices_for_siblings(
      v_affected_groups.subject_id,
      v_affected_groups.parent_id
    );
  END LOOP;
  
  -- Fourth pass: Recalculate codes for all affected topics and their descendants
  IF v_affected_topic_ids IS NOT NULL AND array_length(v_affected_topic_ids, 1) > 0 THEN
    FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
    LOOP
      PERFORM recalculate_topic_code_and_descendants((update_item->>'id')::uuid);
      PERFORM recalculate_topic_file_codes_for_topic_and_descendants((update_item->>'id')::uuid);
    END LOOP;
  END IF;
END;
$$;

-- Create batch_update_topic_file_indices function (similar to topics)
CREATE OR REPLACE FUNCTION batch_update_topic_file_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
  v_affected_file_ids UUID[];
  v_affected_groups RECORD;
BEGIN
  -- Set session variable to prevent triggers from firing
  PERFORM set_config('app.in_batch_update', 'true', true);
  
  -- Collect affected file IDs
  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_file_ids
  FROM jsonb_array_elements(updates) AS item;
  
  -- First pass: Set all indices to negative values to avoid conflicts
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE topics_files
    SET index = -((update_item->>'index')::int + 1000)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION recalculate_topic_indices_for_siblings(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_topic_file_indices_for_siblings(UUID, resource_type, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_topic_file_indices(jsonb) TO authenticated;
