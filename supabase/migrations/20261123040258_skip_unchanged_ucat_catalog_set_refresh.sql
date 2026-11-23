-- Bound acquisition of the relation lock for removing the old hash index.
SET LOCAL lock_timeout = '2s';

-- Trigram duplicate pairs replaced the exact-hash self-join. Keep the stored
-- hash fingerprint and the trigram index used by comparison and import.
DROP INDEX IF EXISTS public.ucat_question_catalog_duplicate_block_idx;

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
  stem_ids UUID[]
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH set_fields AS (
    SELECT
      stem.id AS stem_id,
      COALESCE(set_summary.set_ids, '{}'::UUID[]) AS set_ids,
      COALESCE(set_summary.set_names, '[]'::JSONB) AS set_names,
      COALESCE(set_summary.set_names_text, '') AS set_names_text,
      stem.deleted_at IS NULL
        AND stem.status = 'published'
        AND stem.access_scope = 'public'
        AND COALESCE(set_summary.published_set_count, 0) = 0 AS is_available_in_question_pool
    FROM public.question_stems stem
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '{}'::UUID[]) AS set_ids,
        COALESCE(JSONB_AGG(
          public.ucat_catalog_name_rich_text(public.ucat_question_set_catalog_name(question_set.id, false))
          ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
        ), '[]'::JSONB) AS set_names,
        COALESCE(STRING_AGG(
          public.normalize_ucat_catalog_text(public.ucat_question_set_catalog_name(question_set.id, false)),
          ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
        ), '') AS set_names_text,
        COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
      FROM public.question_stems_question_sets member
      JOIN public.question_sets question_set
        ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
      WHERE member.question_stem_id = stem.id
    ) set_summary ON TRUE
    WHERE stem.id = ANY(COALESCE(stem_ids, '{}'::UUID[]))
  )
  UPDATE public.ucat_question_catalog_projection projection
  SET
    set_ids = set_fields.set_ids,
    set_names = set_fields.set_names,
    set_names_text = set_fields.set_names_text,
    is_available_in_question_pool = set_fields.is_available_in_question_pool,
    refreshed_at = NOW()
  FROM set_fields
  WHERE projection.stem_id = set_fields.stem_id
    AND ROW(
      projection.set_ids,
      projection.set_names,
      projection.set_names_text,
      projection.is_available_in_question_pool
    ) IS DISTINCT FROM ROW(
      set_fields.set_ids,
      set_fields.set_names,
      set_fields.set_names_text,
      set_fields.is_available_in_question_pool
    );
$$;
