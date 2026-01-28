-- Migration: Optimize topic + file code recalculation for subtree
-- Description:
--   - Replace per-row calculate_topic_code usage with set-based recursive updates
--   - Recalculate topic_file codes in a single pass over subtree

CREATE OR REPLACE FUNCTION recalculate_topic_code_and_descendants(p_topic_id UUID)
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

  -- Recalculate codes for the topic and all descendants in one recursive query
  WITH RECURSIVE subtree AS (
    SELECT
      t.id,
      t.parent_id,
      t.index,
      CASE
        WHEN t.parent_id IS NULL THEN t.index::TEXT
        WHEN p.code IS NULL OR p.code = '' THEN t.index::TEXT
        ELSE p.code || '.' || t.index::TEXT
      END AS code
    FROM topics t
    LEFT JOIN topics p ON p.id = t.parent_id
    WHERE t.id = p_topic_id

    UNION ALL

    SELECT
      c.id,
      c.parent_id,
      c.index,
      subtree.code || '.' || c.index::TEXT AS code
    FROM topics c
    JOIN subtree ON c.parent_id = subtree.id
  )
  UPDATE topics t
  SET code = subtree.code
  FROM subtree
  WHERE t.id = subtree.id;

  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION recalculate_topic_file_codes_for_topic_and_descendants(p_topic_id UUID)
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

  -- Recalculate file codes for topic + descendants in one pass
  WITH RECURSIVE subtree AS (
    SELECT
      t.id,
      t.parent_id,
      t.index,
      CASE
        WHEN t.parent_id IS NULL THEN t.index::TEXT
        WHEN p.code IS NULL OR p.code = '' THEN t.index::TEXT
        ELSE p.code || '.' || t.index::TEXT
      END AS code
    FROM topics t
    LEFT JOIN topics p ON p.id = t.parent_id
    WHERE t.id = p_topic_id

    UNION ALL

    SELECT
      c.id,
      c.parent_id,
      c.index,
      subtree.code || '.' || c.index::TEXT AS code
    FROM topics c
    JOIN subtree ON c.parent_id = subtree.id
  )
  UPDATE topics_files tf
  SET code = (
    subtree.code ||
    CASE tf.type::TEXT
      WHEN 'NOTES' THEN 'N'
      WHEN 'PRACTICE_QUESTIONS' THEN 'PQ'
      WHEN 'TEST' THEN 'T'
      WHEN 'VIDEO' THEN 'V'
      WHEN 'EXAM' THEN 'E'
      WHEN 'REVISION_SHEET' THEN 'RS'
      WHEN 'CHEAT_SHEET' THEN 'CS'
      WHEN 'FLASHCARDS' THEN 'F'
      ELSE ''
    END ||
    '.' || tf.index::TEXT ||
    CASE WHEN tf.is_solutions THEN '_SOL' ELSE '' END
  )
  FROM subtree
  WHERE tf.topic_id = subtree.id;

  -- Reset the flag if we set it
  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;
