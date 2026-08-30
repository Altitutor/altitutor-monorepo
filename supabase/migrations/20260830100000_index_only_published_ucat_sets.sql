-- Standalone Set catalog numbers are student-facing publication identity.
-- Draft and in-review Sets stay visible to tutors but do not consume numbers.

ALTER TABLE public.question_sets
  DROP CONSTRAINT question_sets_placement_catalog_index_check;

UPDATE public.question_sets
SET catalog_index = NULL
WHERE status <> 'published';

UPDATE public.question_sets
SET catalog_index = catalog_index + 1000000
WHERE deleted_at IS NULL
  AND mock_id IS NULL
  AND status = 'published';

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY section_id, set_format
      ORDER BY catalog_index, created_at, id
    )::INTEGER AS next_index
  FROM public.question_sets
  WHERE deleted_at IS NULL
    AND mock_id IS NULL
    AND status = 'published'
)
UPDATE public.question_sets question_set
SET catalog_index = ranked.next_index
FROM ranked
WHERE question_set.id = ranked.id;

ALTER TABLE public.question_sets
  ADD CONSTRAINT question_sets_placement_catalog_index_check CHECK (
    (deleted_at IS NULL AND mock_id IS NULL AND status = 'published') =
      (catalog_index IS NOT NULL)
  );

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
    WHEN question_set.mock_id IS NOT NULL THEN format(
      'Mock %s %s',
      mock.catalog_index,
      CASE WHEN p_compact THEN public.ucat_section_abbreviation(section.name) ELSE section.name END
    )
    WHEN question_set.status = 'published' THEN format(
      '%s %s Set %s',
      CASE WHEN p_compact THEN public.ucat_section_abbreviation(section.name) ELSE section.name END,
      CASE question_set.set_format WHEN 'full_section' THEN 'Full' ELSE 'Partial' END,
      question_set.catalog_index
    )
    ELSE format(
      '%s %s Set',
      CASE WHEN p_compact THEN public.ucat_section_abbreviation(section.name) ELSE section.name END,
      CASE question_set.set_format WHEN 'full_section' THEN 'Full' ELSE 'Partial' END
    )
  END
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  LEFT JOIN public.ucat_mocks mock ON mock.id = question_set.mock_id
  WHERE question_set.id = p_set_id;
$$;

CREATE OR REPLACE FUNCTION public.ucat_compact_standalone_set_catalog(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format
)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND mock_id IS NULL
      AND status = 'published'
      AND section_id = p_section_id
      AND set_format = p_set_format
  ), displaced AS (
    UPDATE public.question_sets question_set
    SET catalog_index = ranked.next_index + 1000000
    FROM ranked
    WHERE question_set.id = ranked.id
    RETURNING question_set.id
  )
  UPDATE public.question_sets question_set
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE question_set.id = ranked.id
    AND EXISTS (SELECT 1 FROM displaced WHERE displaced.id = question_set.id);
$$;

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
    AND mock_id IS NULL
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
    AND mock_id IS NULL
    AND status = 'published'
    AND section_id = p_section_id
    AND set_format = p_set_format;

  UPDATE public.question_sets question_set
  SET catalog_index = ordered.position
  FROM unnest(p_set_ids) WITH ORDINALITY ordered(id, position)
  WHERE question_set.id = ordered.id;
END;
$$;

CREATE FUNCTION public.ucat_assign_published_set_catalog_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_should_have_index BOOLEAN;
  v_had_index_scope BOOLEAN;
BEGIN
  v_should_have_index :=
    NEW.deleted_at IS NULL AND NEW.mock_id IS NULL AND NEW.status = 'published';
  IF TG_OP = 'UPDATE' THEN
    v_had_index_scope :=
      OLD.deleted_at IS NULL
      AND OLD.mock_id IS NULL
      AND OLD.status = 'published';
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
      AND question_set.mock_id IS NULL
      AND question_set.status = 'published'
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
      AND question_set.mock_id IS NULL
      AND question_set.status = 'published'
      AND question_set.section_id = NEW.section_id
      AND question_set.set_format = NEW.set_format
      AND question_set.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.ucat_compact_previous_published_set_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL
    AND OLD.mock_id IS NULL
    AND OLD.status = 'published'
    AND (
      NEW.deleted_at IS NOT NULL
      OR NEW.mock_id IS NOT NULL
      OR NEW.status <> 'published'
      OR NEW.section_id IS DISTINCT FROM OLD.section_id
      OR NEW.set_format IS DISTINCT FROM OLD.set_format
    )
  THEN
    PERFORM public.ucat_compact_standalone_set_catalog(OLD.section_id, OLD.set_format);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER assign_published_set_catalog_index
BEFORE INSERT OR UPDATE OF status, mock_id, deleted_at, section_id, set_format
ON public.question_sets
FOR EACH ROW
EXECUTE FUNCTION public.ucat_assign_published_set_catalog_index();

CREATE TRIGGER compact_previous_published_set_scope
AFTER UPDATE OF status, mock_id, deleted_at, section_id, set_format
ON public.question_sets
FOR EACH ROW
EXECUTE FUNCTION public.ucat_compact_previous_published_set_scope();

REVOKE ALL ON FUNCTION public.ucat_assign_published_set_catalog_index()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_compact_previous_published_set_scope()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.question_sets.catalog_index IS
  'Contiguous published standalone position within section and set format; null while unpublished, attached, or deleted.';
