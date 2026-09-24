-- Restore any comparison text cleared by the compatibility migration without
-- firing the row-level pair-maintenance trigger once per catalog row.
ALTER TABLE public.ucat_question_catalog_projection
  DISABLE TRIGGER refresh_ucat_duplicate_stem_pairs;

WITH canonical_stems AS MATERIALIZED (
  SELECT
    stem.id,
    public.canonical_ucat_catalog_rich_text(stem.stem_text) AS comparison_text
  FROM public.question_stems stem
)
UPDATE public.ucat_question_catalog_projection projection
SET
  stem_comparison_text = canonical.comparison_text,
  stem_comparison_hash = MD5(canonical.comparison_text)
FROM canonical_stems canonical
WHERE canonical.id = projection.stem_id
  AND (
    projection.stem_comparison_text IS DISTINCT FROM canonical.comparison_text
    OR projection.stem_comparison_hash IS DISTINCT FROM MD5(canonical.comparison_text)
  );

ALTER TABLE public.ucat_question_catalog_projection
  ENABLE TRIGGER refresh_ucat_duplicate_stem_pairs;

-- Full rebuilds are intentionally set-wise. The row trigger remains useful
-- for maintaining pairs after an individual stem changes, but must not be
-- reused to process the entire catalog.
CREATE OR REPLACE FUNCTION public.rebuild_ucat_duplicate_stem_pairs()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rebuilt_pair_count BIGINT;
  previous_threshold TEXT;
BEGIN
  -- Register pg_trgm's session GUC before reading it. A fresh connection may
  -- not have loaded the extension module yet.
  PERFORM extensions.similarity('', '');
  previous_threshold := current_setting('pg_trgm.similarity_threshold');
  PERFORM set_config('pg_trgm.similarity_threshold', '0.8', TRUE);

  TRUNCATE public.ucat_duplicate_stem_pairs;

  INSERT INTO public.ucat_duplicate_stem_pairs (
    stem_id_low,
    stem_id_high,
    section_id,
    similarity,
    latest_at
  )
  SELECT
    left_projection.stem_id,
    right_projection.stem_id,
    left_stem.section_id,
    extensions.similarity(
      left_projection.stem_comparison_text,
      right_projection.stem_comparison_text
    ),
    GREATEST(left_stem.updated_at, right_stem.updated_at)
  FROM public.ucat_question_catalog_projection left_projection
  JOIN public.question_stems left_stem
    ON left_stem.id = left_projection.stem_id
    AND left_stem.deleted_at IS NULL
  JOIN public.ucat_question_catalog_projection right_projection
    ON right_projection.stem_id > left_projection.stem_id
    AND right_projection.stem_comparison_text <> ''
    AND right_projection.stem_comparison_text
      OPERATOR(extensions.%) left_projection.stem_comparison_text
  JOIN public.question_stems right_stem
    ON right_stem.id = right_projection.stem_id
    AND right_stem.deleted_at IS NULL
    AND right_stem.section_id = left_stem.section_id
  WHERE left_projection.stem_comparison_text <> '';

  GET DIAGNOSTICS rebuilt_pair_count = ROW_COUNT;
  PERFORM set_config(
    'pg_trgm.similarity_threshold',
    previous_threshold,
    TRUE
  );

  RETURN rebuilt_pair_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_ucat_duplicate_stem_pairs()
  FROM PUBLIC, anon, authenticated, service_role;

SELECT public.rebuild_ucat_duplicate_stem_pairs();

ANALYZE public.ucat_duplicate_stem_pairs;
