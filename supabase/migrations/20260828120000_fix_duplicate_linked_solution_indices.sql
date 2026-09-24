-- Production backfill in 20260827160000 failed when two solutions shared a
-- parent (11SPEC Advanced Trig 5T.4). Remotes that already applied 160000 still
-- have the colliding assignment. Keep one inherited parent number and give
-- extra linked solutions unused indices.

CREATE OR REPLACE FUNCTION public.recalculate_topic_file_indices_for_siblings(
  p_topic_id UUID,
  p_type public.resource_type,
  p_is_solutions BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file_ids UUID[];
  v_new_indices INTEGER[];
  v_in_batch_update BOOLEAN;
BEGIN
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;

  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'true', true);
  END IF;

  IF p_is_solutions THEN
    SELECT ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
    INTO v_file_ids
    FROM public.topics_files
    WHERE topic_id = p_topic_id
      AND type = p_type
      AND is_solutions;

    IF v_file_ids IS NULL OR array_length(v_file_ids, 1) = 0 THEN
      IF NOT v_in_batch_update THEN
        PERFORM set_config('app.in_batch_update', 'false', true);
      END IF;
      RETURN;
    END IF;

    v_new_indices := ARRAY(
      SELECT generate_series(1, array_length(v_file_ids, 1))
    );

    UPDATE public.topics_files
    SET index = -(sub.new_index + 1000)
    FROM (
      SELECT
        unnest(v_file_ids) AS id,
        unnest(v_new_indices) AS new_index
    ) sub
    WHERE topics_files.id = sub.id;

    UPDATE public.topics_files tf
    SET index = chosen.parent_index
    FROM (
      SELECT DISTINCT ON (sol.is_solutions_of_id)
        sol.id,
        parent.index AS parent_index
      FROM public.topics_files sol
      JOIN public.topics_files parent ON parent.id = sol.is_solutions_of_id
      WHERE sol.topic_id = p_topic_id
        AND sol.type = p_type
        AND sol.is_solutions
        AND sol.is_solutions_of_id IS NOT NULL
      ORDER BY sol.is_solutions_of_id, sol.created_at ASC, sol.id ASC
    ) chosen
    WHERE tf.id = chosen.id;

    WITH taken AS (
      SELECT tf.index
      FROM public.topics_files tf
      WHERE tf.topic_id = p_topic_id
        AND tf.type = p_type
        AND tf.is_solutions
        AND tf.index > 0
    ),
    leftover AS (
      SELECT
        tf.id,
        ROW_NUMBER() OVER (ORDER BY tf.created_at ASC, tf.id ASC) AS rn
      FROM public.topics_files tf
      WHERE tf.topic_id = p_topic_id
        AND tf.type = p_type
        AND tf.is_solutions
        AND tf.index < 0
    ),
    slots AS (
      SELECT
        gs AS index,
        ROW_NUMBER() OVER (ORDER BY gs) AS rn
      FROM generate_series(
        1,
        COALESCE((SELECT MAX(index) FROM taken), 0)
          + COALESCE((SELECT COUNT(*) FROM leftover), 0)
      ) AS gs
      WHERE NOT EXISTS (
        SELECT 1 FROM taken taken_row WHERE taken_row.index = gs
      )
    )
    UPDATE public.topics_files tf
    SET index = slots.index
    FROM leftover
    JOIN slots ON slots.rn = leftover.rn
    WHERE tf.id = leftover.id;
  ELSE
    SELECT ARRAY_AGG(id ORDER BY index ASC, created_at ASC)
    INTO v_file_ids
    FROM public.topics_files
    WHERE topic_id = p_topic_id
      AND type = p_type
      AND is_solutions = false;

    IF v_file_ids IS NOT NULL AND array_length(v_file_ids, 1) > 0 THEN
      v_new_indices := ARRAY(
        SELECT generate_series(1, array_length(v_file_ids, 1))
      );

      UPDATE public.topics_files
      SET index = -(sub.new_index + 1000)
      FROM (
        SELECT
          unnest(v_file_ids) AS id,
          unnest(v_new_indices) AS new_index
      ) sub
      WHERE topics_files.id = sub.id;

      UPDATE public.topics_files
      SET index = sub.new_index
      FROM (
        SELECT
          unnest(v_file_ids) AS id,
          unnest(v_new_indices) AS new_index
      ) sub
      WHERE topics_files.id = sub.id;
    END IF;

    PERFORM public.recalculate_topic_file_indices_for_siblings(
      p_topic_id,
      p_type,
      true
    );
  END IF;

  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_topic_file_indices_for_siblings(
  UUID,
  public.resource_type,
  BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_topic_file_indices_for_siblings(
  UUID,
  public.resource_type,
  BOOLEAN
) TO service_role;

DO $$
DECLARE
  v_group RECORD;
BEGIN
  FOR v_group IN
    SELECT DISTINCT topic_id, type
    FROM public.topics_files
    WHERE is_solutions
  LOOP
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      v_group.topic_id,
      v_group.type,
      true
    );
  END LOOP;
END;
$$;
