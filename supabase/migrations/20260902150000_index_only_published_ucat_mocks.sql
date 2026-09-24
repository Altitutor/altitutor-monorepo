-- Mock catalog numbers are student-facing publication identity, matching
-- standalone sets. Draft and in-review mocks stay visible to tutors but do
-- not consume numbers.

ALTER TABLE public.ucat_mocks
  DROP CONSTRAINT IF EXISTS ucat_mocks_active_catalog_index_check;

DROP INDEX IF EXISTS public.ucat_mocks_active_catalog_index_key;

CREATE OR REPLACE FUNCTION public.ucat_mock_catalog_name(p_mock_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN mock.deleted_at IS NULL
      AND mock.status = 'published'
      AND mock.catalog_index IS NOT NULL
    THEN format('Mock %s', mock.catalog_index)
    ELSE 'Mock'
  END
  FROM public.ucat_mocks mock
  WHERE mock.id = p_mock_id;
$$;

COMMENT ON FUNCTION public.ucat_mock_catalog_name(UUID) IS
  'Returns Mock N for a published mock, or an unnumbered Mock label otherwise.';

CREATE OR REPLACE FUNCTION public.ucat_compact_mock_catalog()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_displacement INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(20875, 1);

  SELECT COALESCE(max(catalog_index), 0) + count(*)::INTEGER + 1
  INTO v_displacement
  FROM public.ucat_mocks
  WHERE deleted_at IS NULL
    AND status = 'published'
    AND catalog_index IS NOT NULL;

  UPDATE public.ucat_mocks
  SET catalog_index = catalog_index + v_displacement
  WHERE deleted_at IS NULL
    AND status = 'published'
    AND catalog_index IS NOT NULL;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.ucat_mocks
    WHERE deleted_at IS NULL
      AND status = 'published'
      AND catalog_index IS NOT NULL
  )
  UPDATE public.ucat_mocks mock
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE mock.id = ranked.id;
END;
$$;

COMMENT ON FUNCTION public.ucat_compact_mock_catalog()
IS 'Renumbers published mocks contiguously using separate displacement and finalization statements.';

CREATE OR REPLACE FUNCTION public.tutor_ucat_reorder_mocks(p_mock_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(20875, 1);

  SELECT array_agg(id ORDER BY catalog_index, id) INTO v_expected
  FROM public.ucat_mocks
  WHERE deleted_at IS NULL
    AND status = 'published'
    AND catalog_index IS NOT NULL;

  IF cardinality(COALESCE(p_mock_ids, ARRAY[]::UUID[])) <>
      cardinality(COALESCE(v_expected, ARRAY[]::UUID[]))
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(v_expected, ARRAY[]::UUID[])) expected(id)
      WHERE NOT expected.id = ANY(COALESCE(p_mock_ids, ARRAY[]::UUID[]))
    )
    OR cardinality(COALESCE(p_mock_ids, ARRAY[]::UUID[])) <>
      cardinality(ARRAY(
        SELECT DISTINCT id FROM unnest(COALESCE(p_mock_ids, ARRAY[]::UUID[])) id
      ))
  THEN
    RAISE EXCEPTION 'mock_catalog_order_must_include_every_published_mock_once';
  END IF;

  UPDATE public.ucat_mocks
  SET catalog_index = catalog_index + 1000000
  WHERE deleted_at IS NULL
    AND status = 'published'
    AND catalog_index IS NOT NULL;

  UPDATE public.ucat_mocks mock
  SET catalog_index = ordered.position
  FROM unnest(p_mock_ids) WITH ORDINALITY ordered(id, position)
  WHERE mock.id = ordered.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_assign_published_mock_catalog_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_should_have_index BOOLEAN;
  v_had_index_scope BOOLEAN;
BEGIN
  v_should_have_index := NEW.deleted_at IS NULL AND NEW.status = 'published';
  IF TG_OP = 'UPDATE' THEN
    v_had_index_scope := OLD.deleted_at IS NULL AND OLD.status = 'published';
  ELSE
    v_had_index_scope := FALSE;
  END IF;

  IF NOT v_should_have_index THEN
    NEW.catalog_index := NULL;
    RETURN NEW;
  END IF;

  IF NEW.catalog_index IS NULL OR NOT v_had_index_scope THEN
    PERFORM pg_advisory_xact_lock(20875, 1);
    SELECT COALESCE(max(mock.catalog_index), 0) + 1
    INTO NEW.catalog_index
    FROM public.ucat_mocks mock
    WHERE mock.deleted_at IS NULL
      AND mock.status = 'published'
      AND mock.catalog_index IS NOT NULL
      AND mock.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_compact_previous_published_mock_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.ucat_set_catalog_compact_is_deferred() THEN
    RETURN NULL;
  END IF;

  IF OLD.deleted_at IS NULL
    AND OLD.status = 'published'
    AND (
      NEW.deleted_at IS NOT NULL
      OR NEW.status <> 'published'
    )
  THEN
    PERFORM public.ucat_compact_mock_catalog();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS assign_published_mock_catalog_index ON public.ucat_mocks;
CREATE TRIGGER assign_published_mock_catalog_index
BEFORE INSERT OR UPDATE OF status, deleted_at
ON public.ucat_mocks
FOR EACH ROW
EXECUTE FUNCTION public.ucat_assign_published_mock_catalog_index();

DROP TRIGGER IF EXISTS compact_previous_published_mock_scope ON public.ucat_mocks;
CREATE TRIGGER compact_previous_published_mock_scope
AFTER UPDATE OF status, deleted_at
ON public.ucat_mocks
FOR EACH ROW
EXECUTE FUNCTION public.ucat_compact_previous_published_mock_scope();

REVOKE ALL ON FUNCTION public.ucat_assign_published_mock_catalog_index()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_compact_previous_published_mock_scope()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock_v2(
  p_mock_id UUID,
  p_authoring_note TEXT,
  p_access_scope public.ucat_access_scope,
  p_instructions_text JSONB,
  p_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_staff_id UUID;
  v_status public.ucat_content_status;
  v_existing_blueprint_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_blueprint_id IS NULL THEN RAISE EXCEPTION 'mock_blueprint_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id) THEN
    RAISE EXCEPTION 'mock_blueprint_not_found'; END IF;
  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    INSERT INTO public.ucat_mocks (
      name, authoring_note, access_scope, status,
      instructions_text, blueprint_id, created_by, updated_by
    ) VALUES (
      '', NULLIF(BTRIM(p_authoring_note), ''),
      COALESCE(p_access_scope, 'public'), 'draft', p_instructions_text,
      p_blueprint_id, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_mock_id, v_status;
  ELSE
    SELECT blueprint_id, status INTO v_existing_blueprint_id, v_status
    FROM public.ucat_mocks
    WHERE id = p_mock_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
    IF p_blueprint_id IS DISTINCT FROM v_existing_blueprint_id THEN
      RAISE EXCEPTION 'mock_blueprint_requires_eligible_audit';
    END IF;

    UPDATE public.ucat_mocks
    SET authoring_note = NULLIF(BTRIM(p_authoring_note), ''),
        access_scope = COALESCE(p_access_scope, 'public'),
        instructions_text = p_instructions_text,
        updated_by = v_staff_id
    WHERE id = p_mock_id
    RETURNING id INTO v_mock_id;

    UPDATE public.question_sets
    SET access_scope = COALESCE(p_access_scope, 'public'), updated_by = v_staff_id
    WHERE mock_id = v_mock_id;
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;
  RETURN v_mock_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ucat_mocks SET deleted_at = NULL, deleted_by = NULL,
    status = 'draft', status_changed_at = NOW(),
    status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_mock_id AND deleted_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_finish_content_status_catalog_effects(
  p_content_type TEXT,
  p_content_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  IF p_content_type = 'set' THEN
    FOR v_scope IN
      SELECT DISTINCT section_id, set_format
      FROM public.question_sets
      WHERE id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        AND section_id IS NOT NULL
        AND set_format IS NOT NULL
    LOOP
      PERFORM public.ucat_compact_standalone_set_catalog(v_scope.section_id, v_scope.set_format);
    END LOOP;
  ELSIF p_content_type = 'mock' THEN
    PERFORM public.ucat_compact_mock_catalog();
    FOR v_scope IN
      SELECT DISTINCT section_id, set_format
      FROM public.question_sets
      WHERE mock_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        AND section_id IS NOT NULL
        AND set_format IS NOT NULL
    LOOP
      PERFORM public.ucat_compact_standalone_set_catalog(v_scope.section_id, v_scope.set_format);
    END LOOP;
  END IF;

  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
    SELECT DISTINCT member.question_stem_id
    FROM public.question_stems_question_sets member
    WHERE (
      p_content_type = 'stem'
      AND member.question_stem_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
    ) OR (
      p_content_type = 'set'
      AND (
        member.question_set_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        OR member.question_set_id IN (
          SELECT pooled.id
          FROM public.question_sets moved
          JOIN public.question_sets pooled
            ON pooled.section_id = moved.section_id
           AND pooled.set_format = moved.set_format
          WHERE moved.id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
            AND pooled.deleted_at IS NULL
            AND pooled.catalog_index IS NOT NULL
        )
      )
    ) OR (
      p_content_type = 'mock'
      AND member.question_set_id IN (
        SELECT id
        FROM public.question_sets
        WHERE mock_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
      )
    )
  ));
END;
$$;

UPDATE public.ucat_mocks
SET catalog_index = NULL
WHERE status <> 'published' OR deleted_at IS NOT NULL;

SELECT public.ucat_compact_mock_catalog();

CREATE UNIQUE INDEX ucat_mocks_published_catalog_index_key
  ON public.ucat_mocks(catalog_index)
  WHERE catalog_index IS NOT NULL;

ALTER TABLE public.ucat_mocks
  ADD CONSTRAINT ucat_mocks_published_catalog_index_check CHECK (
    (deleted_at IS NULL AND status = 'published') = (catalog_index IS NOT NULL)
  );

COMMENT ON COLUMN public.ucat_mocks.catalog_index IS
  'Contiguous published mock catalog position; null while unpublished or deleted.';
