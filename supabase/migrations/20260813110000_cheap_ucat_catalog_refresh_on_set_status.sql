-- Set status/name/deleted_at only change catalog set membership and pool
-- availability. Rebuilding stem search text and fingerprints on every set
-- UPDATE made bulk publish hit the 8s authenticated statement_timeout.

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
  stem_ids UUID[]
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ucat_question_catalog_projection projection
  SET
    set_ids = COALESCE(set_summary.set_ids, '{}'::UUID[]),
    set_names = COALESCE(set_summary.set_names, '[]'::JSONB),
    set_names_text = COALESCE(set_summary.set_names_text, ''),
    is_available_in_question_pool = (
      stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND COALESCE(set_summary.published_set_count, 0) = 0
    ),
    refreshed_at = NOW()
  FROM public.question_stems stem
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id),
        '{}'::UUID[]
      ) AS set_ids,
      COALESCE(
        JSONB_AGG(question_set.name ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id),
        '[]'::JSONB
      ) AS set_names,
      COALESCE(
        STRING_AGG(
          public.normalize_ucat_catalog_text(
            public.extract_text_from_prosemirror_json(question_set.name)
          ),
          ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
        ),
        ''
      ) AS set_names_text,
      COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
    FROM public.question_stems_question_sets member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id
      AND question_set.deleted_at IS NULL
    WHERE member.question_stem_id = stem.id
  ) set_summary ON TRUE
  WHERE stem.id = projection.stem_id
    AND projection.stem_id = ANY(COALESCE(stem_ids, '{}'::UUID[]));
$$;

COMMENT ON FUNCTION public.refresh_ucat_question_catalog_set_derived_fields_for_stems(UUID[]) IS
  'Updates catalog set names and question-pool availability for the given stems without rebuilding search text or fingerprints.';

REVOKE ALL ON FUNCTION public.refresh_ucat_question_catalog_set_derived_fields_for_stems(UUID[])
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_sets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM new_rows n
    JOIN old_rows o ON o.id = n.id
    WHERE n.name IS DISTINCT FROM o.name
       OR n.status IS DISTINCT FROM o.status
       OR n.deleted_at IS DISTINCT FROM o.deleted_at
  ) THEN
    RETURN NULL;
  END IF;

  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
    ARRAY(
      SELECT DISTINCT member.question_stem_id
      FROM public.question_stems_question_sets member
      WHERE member.question_set_id IN (
        SELECT id FROM new_rows
        UNION
        SELECT id FROM old_rows
      )
    )
  );
  RETURN NULL;
END;
$$;
