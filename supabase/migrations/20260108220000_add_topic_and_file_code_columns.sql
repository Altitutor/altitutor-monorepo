-- Migration: Add code columns to topics and topics_files tables
-- Description: 
--   - Add `code` columns to store calculated topic codes (e.g., "5.2.3") and file codes (e.g., "5.2.3PQ.1")
--   - Create helper functions to calculate codes
--   - Create triggers to automatically maintain codes
--   - Backfill existing data
--   - Update search functions to use stored codes
--   - Update views to include code columns

-- ========================
-- PART 1: ADD CODE COLUMNS
-- ========================

-- Add code column to topics table (nullable initially, will be backfilled)
ALTER TABLE topics 
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Add code column to topics_files table (nullable initially, will be backfilled)
ALTER TABLE topics_files 
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Create indexes for search performance
CREATE INDEX IF NOT EXISTS idx_topics_code ON topics(code);
CREATE INDEX IF NOT EXISTS idx_topics_files_code ON topics_files(code);

-- ========================
-- PART 2: CREATE HELPER FUNCTIONS
-- ========================

-- Function to calculate topic code by traversing parent hierarchy
CREATE OR REPLACE FUNCTION calculate_topic_code(p_topic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_code TEXT;
BEGIN
  WITH RECURSIVE topic_hierarchy AS (
    -- Base case: start with the topic
    SELECT 
      t.id,
      t.index,
      t.parent_id,
      t.index::TEXT AS code_path,
      1 AS depth
    FROM topics t
    WHERE t.id = p_topic_id
    
    UNION ALL
    
    -- Recursive case: traverse up to parent
    SELECT 
      t.id,
      t.index,
      t.parent_id,
      t.index::TEXT || '.' || th.code_path AS code_path,
      th.depth + 1 AS depth
    FROM topics t
    JOIN topic_hierarchy th ON t.id = th.parent_id
  )
  SELECT code_path INTO v_code
  FROM topic_hierarchy
  WHERE parent_id IS NULL
  ORDER BY depth DESC
  LIMIT 1;
  
  RETURN COALESCE(v_code, '');
END;
$$;

-- Function to calculate topic file code
CREATE OR REPLACE FUNCTION calculate_topic_file_code(p_topic_file_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_topic_id UUID;
  v_topic_code TEXT;
  v_type_code TEXT;
  v_file_index INTEGER;
  v_is_solutions BOOLEAN;
  v_code TEXT;
BEGIN
  -- Get topic file details
  SELECT 
    tf.topic_id,
    tf.type,
    tf.index,
    tf.is_solutions
  INTO 
    v_topic_id,
    v_type_code,
    v_file_index,
    v_is_solutions
  FROM topics_files tf
  WHERE tf.id = p_topic_file_id;
  
  IF v_topic_id IS NULL THEN
    RETURN '';
  END IF;
  
  -- Get topic code
  SELECT calculate_topic_code(v_topic_id) INTO v_topic_code;
  
  -- Map resource_type enum to code abbreviation
  v_type_code := CASE v_type_code::TEXT
    WHEN 'NOTES' THEN 'N'
    WHEN 'PRACTICE_QUESTIONS' THEN 'PQ'
    WHEN 'TEST' THEN 'T'
    WHEN 'VIDEO' THEN 'V'
    WHEN 'EXAM' THEN 'E'
    WHEN 'REVISION_SHEET' THEN 'RS'
    WHEN 'CHEAT_SHEET' THEN 'CS'
    WHEN 'FLASHCARDS' THEN 'F'
    ELSE ''
  END;
  
  -- Build code: {topic_code}{type_code}.{index}
  v_code := v_topic_code || v_type_code || '.' || v_file_index::TEXT;
  
  -- Add _SOL suffix if solutions file
  IF v_is_solutions THEN
    v_code := v_code || '_SOL';
  END IF;
  
  RETURN v_code;
END;
$$;

-- Function to recalculate topic code and all descendant codes
CREATE OR REPLACE FUNCTION recalculate_topic_code_and_descendants(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_topic RECORD;
  v_descendant_id UUID;
BEGIN
  -- Calculate and update code for the topic itself
  UPDATE topics
  SET code = calculate_topic_code(id)
  WHERE id = p_topic_id;
  
  -- Recursively update all descendant topics
  FOR v_descendant_id IN 
    WITH RECURSIVE descendants AS (
      SELECT id FROM topics WHERE parent_id = p_topic_id
      UNION ALL
      SELECT t.id FROM topics t
      JOIN descendants d ON t.parent_id = d.id
    )
    SELECT id FROM descendants
  LOOP
    UPDATE topics
    SET code = calculate_topic_code(id)
    WHERE id = v_descendant_id;
  END LOOP;
END;
$$;

-- Function to recalculate all topic file codes for a topic
CREATE OR REPLACE FUNCTION recalculate_topic_file_codes_for_topic(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE topics_files
  SET code = calculate_topic_file_code(id)
  WHERE topic_id = p_topic_id;
END;
$$;

-- Function to recalculate topic file codes for a topic and all descendants
CREATE OR REPLACE FUNCTION recalculate_topic_file_codes_for_topic_and_descendants(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_descendant_id UUID;
BEGIN
  -- Update files for the topic itself
  PERFORM recalculate_topic_file_codes_for_topic(p_topic_id);
  
  -- Recursively update files for all descendant topics
  FOR v_descendant_id IN 
    WITH RECURSIVE descendants AS (
      SELECT id FROM topics WHERE parent_id = p_topic_id
      UNION ALL
      SELECT t.id FROM topics t
      JOIN descendants d ON t.parent_id = d.id
    )
    SELECT id FROM descendants
  LOOP
    PERFORM recalculate_topic_file_codes_for_topic(v_descendant_id);
  END LOOP;
END;
$$;

-- ========================
-- PART 3: CREATE TRIGGERS
-- ========================

-- Trigger function for topics INSERT
CREATE OR REPLACE FUNCTION trigger_calculate_topic_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_code TEXT;
BEGIN
  -- For INSERT, we need to calculate code from parent and index
  -- since the topic doesn't exist in DB yet
  IF NEW.parent_id IS NULL THEN
    -- Root topic: code is just the index
    NEW.code := NEW.index::TEXT;
  ELSE
    -- Child topic: get parent code and append index
    SELECT code INTO v_parent_code
    FROM topics
    WHERE id = NEW.parent_id;
    
    IF v_parent_code IS NULL THEN
      -- Parent doesn't exist (shouldn't happen due to FK constraint)
      NEW.code := NEW.index::TEXT;
    ELSE
      NEW.code := v_parent_code || '.' || NEW.index::TEXT;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for topics UPDATE
CREATE OR REPLACE FUNCTION trigger_update_topic_code_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_code TEXT;
BEGIN
  -- Check if index or parent_id changed
  IF (OLD.index IS DISTINCT FROM NEW.index) OR (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    -- Calculate new code for this topic
    IF NEW.parent_id IS NULL THEN
      -- Root topic: code is just the index
      NEW.code := NEW.index::TEXT;
    ELSE
      -- Child topic: get parent code and append index
      SELECT code INTO v_parent_code
      FROM topics
      WHERE id = NEW.parent_id;
      
      IF v_parent_code IS NULL THEN
        -- Parent doesn't exist (shouldn't happen due to FK constraint)
        NEW.code := NEW.index::TEXT;
      ELSE
        NEW.code := v_parent_code || '.' || NEW.index::TEXT;
      END IF;
    END IF;
  ELSIF NEW.code IS NULL THEN
    -- If code is NULL (shouldn't happen but defensive), calculate it
    NEW.code := calculate_topic_code(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for topics UPDATE (AFTER) to handle descendants
CREATE OR REPLACE FUNCTION trigger_recalculate_descendants_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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

-- Trigger function for topics_files INSERT
CREATE OR REPLACE FUNCTION trigger_calculate_topic_file_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_topic_code TEXT;
  v_type_code TEXT;
  v_code TEXT;
BEGIN
  -- For INSERT, calculate code directly from NEW values
  -- Get topic code
  SELECT code INTO v_topic_code
  FROM topics
  WHERE id = NEW.topic_id;
  
  IF v_topic_code IS NULL THEN
    -- Topic doesn't exist (shouldn't happen due to FK constraint)
    NEW.code := '';
    RETURN NEW;
  END IF;
  
  -- Map resource_type enum to code abbreviation
  v_type_code := CASE NEW.type::TEXT
    WHEN 'NOTES' THEN 'N'
    WHEN 'PRACTICE_QUESTIONS' THEN 'PQ'
    WHEN 'TEST' THEN 'T'
    WHEN 'VIDEO' THEN 'V'
    WHEN 'EXAM' THEN 'E'
    WHEN 'REVISION_SHEET' THEN 'RS'
    WHEN 'CHEAT_SHEET' THEN 'CS'
    WHEN 'FLASHCARDS' THEN 'F'
    ELSE ''
  END;
  
  -- Build code: {topic_code}{type_code}.{index}
  v_code := v_topic_code || v_type_code || '.' || NEW.index::TEXT;
  
  -- Add _SOL suffix if solutions file
  IF NEW.is_solutions THEN
    v_code := v_code || '_SOL';
  END IF;
  
  NEW.code := v_code;
  RETURN NEW;
END;
$$;

-- Trigger function for topics_files UPDATE
CREATE OR REPLACE FUNCTION trigger_update_topic_file_code_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_topic_code TEXT;
  v_type_code TEXT;
  v_code TEXT;
BEGIN
  -- Check if any relevant field changed
  IF (OLD.topic_id IS DISTINCT FROM NEW.topic_id) OR
     (OLD.type IS DISTINCT FROM NEW.type) OR
     (OLD.index IS DISTINCT FROM NEW.index) OR
     (OLD.is_solutions IS DISTINCT FROM NEW.is_solutions) THEN
    -- Recalculate code using NEW values directly
    -- Get topic code
    SELECT code INTO v_topic_code
    FROM topics
    WHERE id = NEW.topic_id;
    
    IF v_topic_code IS NULL THEN
      NEW.code := '';
      RETURN NEW;
    END IF;
    
    -- Map resource_type enum to code abbreviation
    v_type_code := CASE NEW.type::TEXT
      WHEN 'NOTES' THEN 'N'
      WHEN 'PRACTICE_QUESTIONS' THEN 'PQ'
      WHEN 'TEST' THEN 'T'
      WHEN 'VIDEO' THEN 'V'
      WHEN 'EXAM' THEN 'E'
      WHEN 'REVISION_SHEET' THEN 'RS'
      WHEN 'CHEAT_SHEET' THEN 'CS'
      WHEN 'FLASHCARDS' THEN 'F'
      ELSE ''
    END;
    
    -- Build code: {topic_code}{type_code}.{index}
    v_code := v_topic_code || v_type_code || '.' || NEW.index::TEXT;
    
    -- Add _SOL suffix if solutions file
    IF NEW.is_solutions THEN
      v_code := v_code || '_SOL';
    END IF;
    
    NEW.code := v_code;
  ELSIF NEW.code IS NULL THEN
    -- If code is NULL (shouldn't happen but defensive), calculate it
    NEW.code := calculate_topic_file_code(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for topics
DROP TRIGGER IF EXISTS trigger_calculate_topic_code_on_insert ON topics;
CREATE TRIGGER trigger_calculate_topic_code_on_insert
  BEFORE INSERT ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_topic_code_on_insert();

DROP TRIGGER IF EXISTS trigger_update_topic_code_on_change ON topics;
CREATE TRIGGER trigger_update_topic_code_on_change
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_topic_code_on_change();

DROP TRIGGER IF EXISTS trigger_recalculate_descendants_after_update ON topics;
CREATE TRIGGER trigger_recalculate_descendants_after_update
  AFTER UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_descendants_after_update();

-- Create triggers for topics_files
DROP TRIGGER IF EXISTS trigger_calculate_topic_file_code_on_insert ON topics_files;
CREATE TRIGGER trigger_calculate_topic_file_code_on_insert
  BEFORE INSERT ON topics_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_topic_file_code_on_insert();

DROP TRIGGER IF EXISTS trigger_update_topic_file_code_on_change ON topics_files;
CREATE TRIGGER trigger_update_topic_file_code_on_change
  BEFORE UPDATE ON topics_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_topic_file_code_on_change();

-- ========================
-- PART 4: UPDATE BATCH UPDATE FUNCTION
-- ========================

-- Update batch_update_topic_indices to recalculate codes after batch update
CREATE OR REPLACE FUNCTION batch_update_topic_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
  v_affected_topic_ids UUID[];
BEGIN
  -- Collect affected topic IDs
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

  -- Second pass: Set actual indices
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE topics
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;
  
  -- Third pass: Recalculate codes for all affected topics and their descendants
  -- We need to recalculate for each affected topic and all its descendants
  IF v_affected_topic_ids IS NOT NULL AND array_length(v_affected_topic_ids, 1) > 0 THEN
    FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
    LOOP
      PERFORM recalculate_topic_code_and_descendants((update_item->>'id')::uuid);
      PERFORM recalculate_topic_file_codes_for_topic_and_descendants((update_item->>'id')::uuid);
    END LOOP;
  END IF;
END;
$$;

-- ========================
-- PART 5: BACKFILL EXISTING DATA
-- ========================

-- Backfill topic codes
UPDATE topics
SET code = calculate_topic_code(id)
WHERE code IS NULL;

-- Backfill topic file codes
UPDATE topics_files
SET code = calculate_topic_file_code(id)
WHERE code IS NULL;

-- Add NOT NULL constraints after backfill
ALTER TABLE topics 
  ALTER COLUMN code SET NOT NULL;

ALTER TABLE topics_files 
  ALTER COLUMN code SET NOT NULL;

-- ========================
-- PART 6: CREATE VALIDATION FUNCTION
-- ========================

-- Function to validate all topic codes are correct
CREATE OR REPLACE FUNCTION validate_all_topic_codes()
RETURNS TABLE(
  topic_id UUID,
  stored_code TEXT,
  calculated_code TEXT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS topic_id,
    t.code AS stored_code,
    calculate_topic_code(t.id) AS calculated_code,
    (t.code = calculate_topic_code(t.id)) AS is_valid
  FROM topics t
  WHERE t.code IS DISTINCT FROM calculate_topic_code(t.id);
END;
$$;

-- Function to validate all topic file codes are correct
CREATE OR REPLACE FUNCTION validate_all_topic_file_codes()
RETURNS TABLE(
  topic_file_id UUID,
  stored_code TEXT,
  calculated_code TEXT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tf.id AS topic_file_id,
    tf.code AS stored_code,
    calculate_topic_file_code(tf.id) AS calculated_code,
    (tf.code = calculate_topic_file_code(tf.id)) AS is_valid
  FROM topics_files tf
  WHERE tf.code IS DISTINCT FROM calculate_topic_file_code(tf.id);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_topic_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_topic_file_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_all_topic_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_all_topic_file_codes() TO authenticated;

COMMENT ON FUNCTION calculate_topic_code(UUID) IS 'Calculates topic code by traversing parent hierarchy (e.g., "5.2.3")';
COMMENT ON FUNCTION calculate_topic_file_code(UUID) IS 'Calculates topic file code (e.g., "5.2.3PQ.1" or "5.2.3PQ.1_SOL")';
COMMENT ON FUNCTION validate_all_topic_codes() IS 'Validates all stored topic codes match calculated codes';
COMMENT ON FUNCTION validate_all_topic_file_codes() IS 'Validates all stored topic file codes match calculated codes';

