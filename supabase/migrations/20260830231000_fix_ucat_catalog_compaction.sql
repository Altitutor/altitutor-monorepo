-- PostgreSQL does not support predictably updating the same row twice in one
-- data-modifying CTE statement. The previous compaction functions could leave
-- the temporary +1,000,000 displacement as the persisted catalog index.

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
    AND mock_id IS NULL
    AND status = 'published'
    AND section_id = p_section_id
    AND set_format = p_set_format;

  UPDATE public.question_sets
  SET catalog_index = catalog_index + v_displacement
  WHERE deleted_at IS NULL
    AND mock_id IS NULL
    AND status = 'published'
    AND section_id = p_section_id
    AND set_format = p_set_format;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND mock_id IS NULL
      AND status = 'published'
      AND section_id = p_section_id
      AND set_format = p_set_format
  )
  UPDATE public.question_sets question_set
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE question_set.id = ranked.id;
END;
$$;

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
  WHERE deleted_at IS NULL;

  UPDATE public.ucat_mocks
  SET catalog_index = catalog_index + v_displacement
  WHERE deleted_at IS NULL;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.ucat_mocks
    WHERE deleted_at IS NULL
  )
  UPDATE public.ucat_mocks mock
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE mock.id = ranked.id;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_compact_mock_catalog()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_compact_standalone_set_catalog(
  UUID, public.ucat_question_set_format
) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.ucat_compact_mock_catalog()
IS 'Renumbers active mocks contiguously using separate displacement and finalization statements.';
COMMENT ON FUNCTION public.ucat_compact_standalone_set_catalog(
  UUID, public.ucat_question_set_format
) IS 'Renumbers one published standalone set scope contiguously using separate displacement and finalization statements.';

-- Repair any temporary displacement values already persisted in production.
SELECT public.ucat_compact_mock_catalog();

DO $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    SELECT DISTINCT section_id, set_format
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND mock_id IS NULL
      AND status = 'published'
  LOOP
    PERFORM public.ucat_compact_standalone_set_catalog(
      v_scope.section_id,
      v_scope.set_format
    );
  END LOOP;
END;
$$;
