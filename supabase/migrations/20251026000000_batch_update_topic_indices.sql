-- Migration: Batch update topic indices using temporary negative indices to avoid conflicts
-- This function updates multiple topic indices atomically to prevent unique constraint violations

CREATE OR REPLACE FUNCTION batch_update_topic_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
BEGIN
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION batch_update_topic_indices(jsonb) TO authenticated;

