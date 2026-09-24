-- Linked solution files must share the parent file's number (2T.1 -> 2T.1_SOL).
-- Unlinked solutions keep a separate sequence that does not occupy a linked number.
-- If two solutions share a parent, only the earliest inherits that number.

CREATE OR REPLACE FUNCTION public.calculate_topic_file_code(p_topic_file_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_topic_code TEXT;
  v_type public.resource_type;
  v_file_index INTEGER;
  v_is_solutions BOOLEAN;
  v_is_solutions_of_id UUID;
  v_parent_index INTEGER;
  v_type_code TEXT;
  v_code TEXT;
BEGIN
  SELECT
    t.code,
    tf.type,
    tf.index,
    tf.is_solutions,
    tf.is_solutions_of_id
  INTO
    v_topic_code,
    v_type,
    v_file_index,
    v_is_solutions,
    v_is_solutions_of_id
  FROM public.topics_files tf
  JOIN public.topics t ON t.id = tf.topic_id
  WHERE tf.id = p_topic_file_id;

  IF v_topic_code IS NULL THEN
    RETURN '';
  END IF;

  IF v_is_solutions AND v_is_solutions_of_id IS NOT NULL THEN
    SELECT parent.index
    INTO v_parent_index
    FROM public.topics_files parent
    WHERE parent.id = v_is_solutions_of_id;

    IF v_parent_index IS NOT NULL THEN
      v_file_index := v_parent_index;
    END IF;
  END IF;

  v_type_code := CASE v_type::TEXT
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

  v_code := v_topic_code || v_type_code || '.' || v_file_index::TEXT;

  IF v_is_solutions THEN
    v_code := v_code || '_SOL';
  END IF;

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.calculate_topic_file_code(UUID) IS
  'Calculates topic file code (e.g. "5.2.3PQ.1" or "5.2.3PQ.1_SOL"). Linked solutions use the parent file number.';

CREATE OR REPLACE FUNCTION public.trigger_calculate_topic_file_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_topic_code TEXT;
  v_type_code TEXT;
  v_file_index INTEGER;
  v_parent_index INTEGER;
  v_code TEXT;
BEGIN
  SELECT code INTO v_topic_code
  FROM public.topics
  WHERE id = NEW.topic_id;

  IF v_topic_code IS NULL THEN
    NEW.code := '';
    RETURN NEW;
  END IF;

  v_file_index := NEW.index;
  IF NEW.is_solutions AND NEW.is_solutions_of_id IS NOT NULL THEN
    SELECT parent.index
    INTO v_parent_index
    FROM public.topics_files parent
    WHERE parent.id = NEW.is_solutions_of_id;

    IF v_parent_index IS NOT NULL THEN
      v_file_index := v_parent_index;
    END IF;
  END IF;

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

  v_code := v_topic_code || v_type_code || '.' || v_file_index::TEXT;
  IF NEW.is_solutions THEN
    v_code := v_code || '_SOL';
  END IF;

  NEW.code := v_code;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_topic_file_code_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_topic_code TEXT;
  v_type_code TEXT;
  v_file_index INTEGER;
  v_parent_index INTEGER;
  v_code TEXT;
BEGIN
  IF (OLD.topic_id IS DISTINCT FROM NEW.topic_id)
     OR (OLD.type IS DISTINCT FROM NEW.type)
     OR (OLD.index IS DISTINCT FROM NEW.index)
     OR (OLD.is_solutions IS DISTINCT FROM NEW.is_solutions)
     OR (OLD.is_solutions_of_id IS DISTINCT FROM NEW.is_solutions_of_id)
     OR NEW.code IS NULL THEN
    SELECT code INTO v_topic_code
    FROM public.topics
    WHERE id = NEW.topic_id;

    IF v_topic_code IS NULL THEN
      NEW.code := '';
      RETURN NEW;
    END IF;

    v_file_index := NEW.index;
    IF NEW.is_solutions AND NEW.is_solutions_of_id IS NOT NULL THEN
      SELECT parent.index
      INTO v_parent_index
      FROM public.topics_files parent
      WHERE parent.id = NEW.is_solutions_of_id;

      IF v_parent_index IS NOT NULL THEN
        v_file_index := v_parent_index;
      END IF;
    END IF;

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

    v_code := v_topic_code || v_type_code || '.' || v_file_index::TEXT;
    IF NEW.is_solutions THEN
      v_code := v_code || '_SOL';
    END IF;

    NEW.code := v_code;
  END IF;

  RETURN NEW;
END;
$$;

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

    -- At most one solution per parent can inherit that parent's number.
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

CREATE OR REPLACE FUNCTION public.recalculate_topic_file_codes_for_topic_and_descendants(
  p_topic_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  WITH RECURSIVE subtree AS (
    SELECT t.id
    FROM public.topics t
    WHERE t.id = p_topic_id

    UNION ALL

    SELECT c.id
    FROM public.topics c
    JOIN subtree ON c.parent_id = subtree.id
  )
  UPDATE public.topics_files tf
  SET code = public.calculate_topic_file_code(tf.id)
  FROM subtree
  WHERE tf.topic_id = subtree.id;

  IF NOT v_in_batch_update THEN
    PERFORM set_config('app.in_batch_update', 'false', true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_changed BOOLEAN;
  v_type_changed BOOLEAN;
  v_solutions_changed BOOLEAN;
  v_link_changed BOOLEAN;
  v_index_changed BOOLEAN;
  v_in_batch_update BOOLEAN;
BEGIN
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;

  IF v_in_batch_update THEN
    RETURN NEW;
  END IF;

  v_topic_changed := (OLD.topic_id IS DISTINCT FROM NEW.topic_id);
  v_type_changed := (OLD.type IS DISTINCT FROM NEW.type);
  v_solutions_changed := (OLD.is_solutions IS DISTINCT FROM NEW.is_solutions);
  v_link_changed := (OLD.is_solutions_of_id IS DISTINCT FROM NEW.is_solutions_of_id);
  v_index_changed := (OLD.index IS DISTINCT FROM NEW.index);

  IF v_topic_changed OR v_type_changed OR v_solutions_changed THEN
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      OLD.topic_id,
      OLD.type,
      OLD.is_solutions
    );
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      NEW.topic_id,
      NEW.type,
      NEW.is_solutions
    );
    IF NOT OLD.is_solutions THEN
      PERFORM public.recalculate_topic_file_indices_for_siblings(
        OLD.topic_id,
        OLD.type,
        true
      );
    END IF;
    IF NOT NEW.is_solutions THEN
      PERFORM public.recalculate_topic_file_indices_for_siblings(
        NEW.topic_id,
        NEW.type,
        true
      );
    END IF;
  ELSIF v_link_changed AND NEW.is_solutions THEN
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      NEW.topic_id,
      NEW.type,
      true
    );
  ELSIF v_index_changed AND NOT NEW.is_solutions THEN
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      NEW.topic_id,
      NEW.type,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_topic_file_indices_for_siblings(
    OLD.topic_id,
    OLD.type,
    OLD.is_solutions
  );

  IF NOT OLD.is_solutions THEN
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      OLD.topic_id,
      OLD.type,
      true
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_solution_file_indices_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_batch_update BOOLEAN;
BEGIN
  BEGIN
    v_in_batch_update := current_setting('app.in_batch_update', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_in_batch_update := false;
  END;

  IF v_in_batch_update THEN
    RETURN NEW;
  END IF;

  PERFORM public.recalculate_topic_file_indices_for_siblings(
    NEW.topic_id,
    NEW.type,
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_solution_file_indices_after_insert ON public.topics_files;
CREATE TRIGGER trigger_sync_solution_file_indices_after_insert
  AFTER INSERT ON public.topics_files
  FOR EACH ROW
  WHEN (NEW.is_solutions)
  EXECUTE FUNCTION public.trigger_sync_solution_file_indices_after_insert();

REVOKE ALL ON FUNCTION public.trigger_sync_solution_file_indices_after_insert()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_sync_solution_file_indices_after_insert()
  TO service_role;

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

REVOKE ALL ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
  TO service_role;

CREATE OR REPLACE FUNCTION public.batch_update_topic_file_indices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  update_item jsonb;
  v_affected_file_ids UUID[];
  v_affected_groups RECORD;
  v_counter INTEGER := 0;
BEGIN
  PERFORM set_config('app.in_batch_update', 'true', true);

  SELECT ARRAY_AGG((item->>'id')::uuid)
  INTO v_affected_file_ids
  FROM jsonb_array_elements(updates) AS item;

  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    v_counter := v_counter + 1;
    UPDATE public.topics_files
    SET index = -(10000 + v_counter)
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.topics_files
    SET index = (update_item->>'index')::int
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;

  PERFORM set_config('app.in_batch_update', 'false', true);

  FOR v_affected_groups IN
    SELECT DISTINCT topic_id, type, is_solutions
    FROM public.topics_files
    WHERE id = ANY(v_affected_file_ids)
  LOOP
    PERFORM public.recalculate_topic_file_indices_for_siblings(
      v_affected_groups.topic_id,
      v_affected_groups.type,
      v_affected_groups.is_solutions
    );
  END LOOP;
END;
$$;

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
