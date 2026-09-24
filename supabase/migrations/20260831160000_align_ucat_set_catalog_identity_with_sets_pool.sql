-- Catalog identity follows sets-pool occupancy, not mock_id. A published
-- non-deleted mock still occupies its component sets; deleted and unpublished
-- mocks keep ownership for restore but those sets join the standalone sequence.

CREATE OR REPLACE FUNCTION public.ucat_mock_occupies_sets_pool(p_mock_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT mock.deleted_at IS NULL AND mock.status = 'published'
      FROM public.ucat_mocks mock
      WHERE mock.id = p_mock_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_occupies_sets_pool(UUID)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.ucat_mock_occupies_sets_pool(UUID) IS
  'True when a published, non-deleted mock currently occupies its component sets in the catalog.';

CREATE OR REPLACE FUNCTION public.ucat_question_set_catalog_name(
  p_set_id UUID,
  p_compact BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN mock.id IS NOT NULL
      AND mock.deleted_at IS NULL
      AND mock.status = 'published'
    THEN format(
      'Mock %s %s',
      mock.catalog_index,
      CASE
        WHEN p_compact THEN public.ucat_section_abbreviation(section.name)
        ELSE section.name
      END
    )
    WHEN question_set.status = 'published' AND question_set.catalog_index IS NOT NULL THEN format(
      '%s %s Set %s',
      CASE
        WHEN p_compact THEN public.ucat_section_abbreviation(section.name)
        ELSE section.name
      END,
      CASE question_set.set_format WHEN 'full_section' THEN 'Full' ELSE 'Partial' END,
      question_set.catalog_index
    )
    ELSE format(
      '%s %s Set',
      CASE
        WHEN p_compact THEN public.ucat_section_abbreviation(section.name)
        ELSE section.name
      END,
      CASE question_set.set_format WHEN 'full_section' THEN 'Full' ELSE 'Partial' END
    )
  END
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  LEFT JOIN public.ucat_mocks mock ON mock.id = question_set.mock_id
  WHERE question_set.id = p_set_id;
$$;

COMMENT ON FUNCTION public.ucat_question_set_catalog_name(UUID, BOOLEAN) IS
  'Standalone sets-pool label, or mock-relative label only while a published non-deleted mock occupies the set.';

CREATE OR REPLACE FUNCTION public.ucat_compact_standalone_set_catalog(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_displacement INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_section_id::TEXT || ':' || p_set_format::TEXT,
    20876
  ));

  SELECT COALESCE(max(catalog_index), 0) + count(*)::INTEGER + 1
  INTO v_displacement
  FROM public.question_sets
  WHERE deleted_at IS NULL
    AND catalog_index IS NOT NULL
    AND section_id = p_section_id
    AND set_format = p_set_format;

  UPDATE public.question_sets
  SET catalog_index = catalog_index + v_displacement
  WHERE deleted_at IS NULL
    AND catalog_index IS NOT NULL
    AND section_id = p_section_id
    AND set_format = p_set_format;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND catalog_index IS NOT NULL
      AND section_id = p_section_id
      AND set_format = p_set_format
  )
  UPDATE public.question_sets question_set
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE question_set.id = ranked.id;
END;
$$;

COMMENT ON FUNCTION public.ucat_compact_standalone_set_catalog(
  UUID, public.ucat_question_set_format
) IS 'Renumbers one published sets-pool catalog scope contiguously.';

CREATE OR REPLACE FUNCTION public.tutor_ucat_reorder_question_sets(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format,
  p_set_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_section_id::TEXT || ':' || p_set_format::TEXT,
    20876
  ));

  SELECT array_agg(id ORDER BY catalog_index, id) INTO v_expected
  FROM public.question_sets
  WHERE deleted_at IS NULL
    AND catalog_index IS NOT NULL
    AND status = 'published'
    AND section_id = p_section_id
    AND set_format = p_set_format;

  IF cardinality(COALESCE(p_set_ids, ARRAY[]::UUID[])) <>
      cardinality(COALESCE(v_expected, ARRAY[]::UUID[]))
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(v_expected, ARRAY[]::UUID[])) expected(id)
      WHERE NOT expected.id = ANY(COALESCE(p_set_ids, ARRAY[]::UUID[]))
    )
    OR cardinality(COALESCE(p_set_ids, ARRAY[]::UUID[])) <>
      cardinality(ARRAY(
        SELECT DISTINCT id FROM unnest(COALESCE(p_set_ids, ARRAY[]::UUID[])) id
      ))
  THEN
    RAISE EXCEPTION 'set_catalog_order_must_include_every_published_set_once';
  END IF;

  UPDATE public.question_sets
  SET catalog_index = catalog_index + 1000000
  WHERE deleted_at IS NULL
    AND catalog_index IS NOT NULL
    AND status = 'published'
    AND section_id = p_section_id
    AND set_format = p_set_format;

  UPDATE public.question_sets question_set
  SET catalog_index = ordered.position
  FROM unnest(p_set_ids) WITH ORDINALITY ordered(id, position)
  WHERE question_set.id = ordered.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_assign_published_set_catalog_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_should_have_index BOOLEAN;
  v_had_index_scope BOOLEAN;
BEGIN
  v_should_have_index :=
    NEW.deleted_at IS NULL
    AND NEW.status = 'published'
    AND NOT public.ucat_mock_occupies_sets_pool(NEW.mock_id);
  IF TG_OP = 'UPDATE' THEN
    v_had_index_scope :=
      OLD.deleted_at IS NULL
      AND OLD.status = 'published'
      AND NOT public.ucat_mock_occupies_sets_pool(OLD.mock_id);
  ELSE
    v_had_index_scope := FALSE;
  END IF;

  IF NOT v_should_have_index THEN
    NEW.catalog_index := NULL;
    RETURN NEW;
  END IF;

  IF NEW.catalog_index IS NULL OR NOT v_had_index_scope THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.section_id::TEXT || ':' || NEW.set_format::TEXT,
      20876
    ));
    SELECT COALESCE(max(question_set.catalog_index), 0) + 1
    INTO NEW.catalog_index
    FROM public.question_sets question_set
    WHERE question_set.deleted_at IS NULL
      AND question_set.catalog_index IS NOT NULL
      AND question_set.section_id = NEW.section_id
      AND question_set.set_format = NEW.set_format
      AND question_set.id IS DISTINCT FROM NEW.id;
  ELSIF NEW.section_id IS DISTINCT FROM OLD.section_id
    OR NEW.set_format IS DISTINCT FROM OLD.set_format
  THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.section_id::TEXT || ':' || NEW.set_format::TEXT,
      20876
    ));
    SELECT COALESCE(max(question_set.catalog_index), 0) + 1
    INTO NEW.catalog_index
    FROM public.question_sets question_set
    WHERE question_set.deleted_at IS NULL
      AND question_set.catalog_index IS NOT NULL
      AND question_set.section_id = NEW.section_id
      AND question_set.set_format = NEW.set_format
      AND question_set.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_compact_previous_published_set_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_had_index_scope BOOLEAN;
  v_should_have_index BOOLEAN;
BEGIN
  v_had_index_scope :=
    OLD.deleted_at IS NULL
    AND OLD.status = 'published'
    AND NOT public.ucat_mock_occupies_sets_pool(OLD.mock_id);
  v_should_have_index :=
    NEW.deleted_at IS NULL
    AND NEW.status = 'published'
    AND NOT public.ucat_mock_occupies_sets_pool(NEW.mock_id);

  IF v_had_index_scope
    AND (
      NOT v_should_have_index
      OR NEW.section_id IS DISTINCT FROM OLD.section_id
      OR NEW.set_format IS DISTINCT FROM OLD.set_format
    )
  THEN
    PERFORM public.ucat_compact_standalone_set_catalog(OLD.section_id, OLD.set_format);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_sync_component_sets_for_mock_occupancy(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_occupies BOOLEAN;
  v_scope RECORD;
BEGIN
  v_occupies := public.ucat_mock_occupies_sets_pool(p_mock_id);

  IF v_occupies THEN
    FOR v_scope IN
      SELECT DISTINCT question_set.section_id, question_set.set_format
      FROM public.question_sets question_set
      WHERE question_set.mock_id = p_mock_id
        AND question_set.deleted_at IS NULL
        AND question_set.status = 'published'
    LOOP
      UPDATE public.question_sets
      SET catalog_index = NULL
      WHERE mock_id = p_mock_id
        AND section_id = v_scope.section_id
        AND set_format = v_scope.set_format
        AND deleted_at IS NULL;
      PERFORM public.ucat_compact_standalone_set_catalog(
        v_scope.section_id,
        v_scope.set_format
      );
    END LOOP;
    RETURN;
  END IF;

  FOR v_scope IN
    SELECT DISTINCT question_set.section_id, question_set.set_format
    FROM public.question_sets question_set
    WHERE question_set.mock_id = p_mock_id
      AND question_set.deleted_at IS NULL
      AND question_set.status = 'published'
      AND question_set.catalog_index IS NULL
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      v_scope.section_id::TEXT || ':' || v_scope.set_format::TEXT,
      20876
    ));
    WITH ranked AS (
      SELECT
        question_set.id,
        COALESCE((
          SELECT max(existing.catalog_index)
          FROM public.question_sets existing
          WHERE existing.deleted_at IS NULL
            AND existing.catalog_index IS NOT NULL
            AND existing.section_id = v_scope.section_id
            AND existing.set_format = v_scope.set_format
        ), 0)
          + row_number() OVER (ORDER BY question_set.created_at, question_set.id)
          AS next_index
      FROM public.question_sets question_set
      WHERE question_set.mock_id = p_mock_id
        AND question_set.section_id = v_scope.section_id
        AND question_set.set_format = v_scope.set_format
        AND question_set.deleted_at IS NULL
        AND question_set.status = 'published'
        AND question_set.catalog_index IS NULL
    )
    UPDATE public.question_sets question_set
    SET catalog_index = ranked.next_index
    FROM ranked
    WHERE question_set.id = ranked.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_sync_component_sets_for_mock_occupancy(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_sync_set_catalog_on_mock_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_occupies BOOLEAN;
  v_new_occupies BOOLEAN;
BEGIN
  v_old_occupies :=
    TG_OP <> 'INSERT'
    AND OLD.deleted_at IS NULL
    AND OLD.status = 'published';
  v_new_occupies :=
    NEW.deleted_at IS NULL
    AND NEW.status = 'published';

  IF v_old_occupies IS NOT DISTINCT FROM v_new_occupies THEN
    RETURN NEW;
  END IF;

  PERFORM public.ucat_sync_component_sets_for_mock_occupancy(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_set_catalog_on_mock_occupancy ON public.ucat_mocks;
CREATE TRIGGER sync_set_catalog_on_mock_occupancy
AFTER INSERT OR UPDATE OF status, deleted_at
ON public.ucat_mocks
FOR EACH ROW
EXECUTE FUNCTION public.ucat_sync_set_catalog_on_mock_occupancy();

REVOKE ALL ON FUNCTION public.ucat_sync_set_catalog_on_mock_occupancy()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_detach_mock_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
  v_mock_status public.ucat_content_status;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_set FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_set.mock_id IS NULL THEN RAISE EXCEPTION 'mock_component_set_not_found'; END IF;
  SELECT status INTO v_mock_status FROM public.ucat_mocks WHERE id = v_set.mock_id FOR UPDATE;
  IF v_mock_status <> 'draft' THEN RAISE EXCEPTION 'mock_membership_changes_require_draft'; END IF;

  UPDATE public.question_sets
  SET mock_id = NULL, updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_attach_mock_set(p_mock_id UUID, p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
  v_mock public.ucat_mocks%ROWTYPE;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_mock FROM public.ucat_mocks
  WHERE id = p_mock_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
  IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'mock_membership_changes_require_draft'; END IF;

  SELECT * INTO v_set FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_set.mock_id IS NOT NULL THEN RAISE EXCEPTION 'standalone_set_required'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_mock_blueprint_sections blueprint_section
    JOIN public.ucat_sections section
      ON section.section_number = blueprint_section.section_index + 1
    WHERE blueprint_section.blueprint_id = v_mock.blueprint_id
      AND section.id = v_set.section_id
  ) THEN RAISE EXCEPTION 'set_section_not_in_mock_blueprint'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.question_sets
    WHERE mock_id = p_mock_id AND section_id = v_set.section_id
  ) THEN RAISE EXCEPTION 'mock_section_slot_occupied'; END IF;

  UPDATE public.question_sets
  SET mock_id = p_mock_id,
      reference_blueprint_id = v_mock.blueprint_id,
      set_format = 'full_section',
      timing_mode = 'pace',
      pace_multiplier = 1,
      fixed_time_limit_seconds = NULL,
      updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
  IF v_set.set_format IS DISTINCT FROM 'full_section'::public.ucat_question_set_format THEN
    PERFORM public.ucat_compact_standalone_set_catalog(v_set.section_id, v_set.set_format);
  END IF;
END;
$$;

ALTER TABLE public.question_sets
  DROP CONSTRAINT IF EXISTS question_sets_placement_catalog_index_check;

DROP INDEX IF EXISTS public.question_sets_active_standalone_catalog_index_key;
CREATE UNIQUE INDEX question_sets_active_standalone_catalog_index_key
  ON public.question_sets(section_id, set_format, catalog_index)
  WHERE catalog_index IS NOT NULL;

DO $$
DECLARE
  v_mock RECORD;
  v_scope RECORD;
BEGIN
  FOR v_mock IN
    SELECT DISTINCT mock_id AS id
    FROM public.question_sets
    WHERE mock_id IS NOT NULL
  LOOP
    PERFORM public.ucat_sync_component_sets_for_mock_occupancy(v_mock.id);
  END LOOP;

  FOR v_scope IN
    SELECT DISTINCT section_id, set_format
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND status = 'published'
      AND catalog_index IS NOT NULL
  LOOP
    PERFORM public.ucat_compact_standalone_set_catalog(
      v_scope.section_id,
      v_scope.set_format
    );
  END LOOP;
END;
$$;

ALTER TABLE public.question_sets
  ADD CONSTRAINT question_sets_placement_catalog_index_check CHECK (
    (
      deleted_at IS NULL
      AND status = 'published'
      AND NOT public.ucat_mock_occupies_sets_pool(mock_id)
    ) = (catalog_index IS NOT NULL)
  );

COMMENT ON COLUMN public.question_sets.catalog_index IS
  'Contiguous published sets-pool position within section and format; null while unpublished, deleted, or occupied by a published non-deleted mock.';
