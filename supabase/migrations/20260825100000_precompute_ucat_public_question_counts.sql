-- Public catalogue denominators are identical for every online student. Keep
-- that invariant precomputed; only session-entitled private content remains a
-- per-request aggregate.

CREATE MATERIALIZED VIEW public.ucat_public_question_counts_cache AS
WITH question_rows AS (
  SELECT
    question.answer_scheme,
    question.question_stem_id,
    stem.section_id,
    stem.question_stem_category_id,
    row_number() OVER (
      PARTITION BY question.question_stem_id, question.answer_scheme
      ORDER BY question.index NULLS LAST, question.id
    ) AS scheme_stem_index
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  WHERE question.deleted_at IS NULL
    AND stem.deleted_at IS NULL
    AND stem.status = 'published'
    AND stem.access_scope = 'public'
)
SELECT
  question_rows.section_id,
  question_rows.question_stem_category_id,
  sum(
    CASE
      WHEN question_rows.answer_scheme = 'decision_making_binary_placement'
        AND question_rows.scheme_stem_index = 1 THEN 2
      WHEN question_rows.answer_scheme = 'decision_making_binary_placement' THEN 0
      ELSE 1
    END
  )::integer AS total_questions
FROM question_rows
GROUP BY question_rows.section_id, question_rows.question_stem_category_id;

CREATE UNIQUE INDEX idx_ucat_public_question_counts_cache_key
  ON public.ucat_public_question_counts_cache (
    section_id,
    question_stem_category_id
  ) NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.refresh_ucat_public_question_counts_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.ucat_public_question_counts_cache;
  RETURN NULL;
END;
$$;

CREATE TRIGGER refresh_ucat_public_question_counts_on_questions
AFTER INSERT OR DELETE OR UPDATE OF
  answer_scheme, question_stem_id, deleted_at, "index"
ON public.ucat_questions
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_ucat_public_question_counts_cache();

CREATE TRIGGER refresh_ucat_public_question_counts_on_stems
AFTER INSERT OR DELETE OR UPDATE OF
  section_id, question_stem_category_id, deleted_at, status, access_scope
ON public.question_stems
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_ucat_public_question_counts_cache();

CREATE OR REPLACE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH context AS (
  SELECT access.has_online_access
  FROM public.vstudent_ucat_access_context access
), cached_public AS (
  SELECT cache.section_id, cache.question_stem_category_id, cache.total_questions
  FROM public.ucat_public_question_counts_cache cache
  CROSS JOIN context
  WHERE context.has_online_access
), private_question_rows AS (
  SELECT
    question.answer_scheme,
    question.question_stem_id,
    stem.section_id,
    stem.question_stem_category_id,
    row_number() OVER (
      PARTITION BY question.question_stem_id, question.answer_scheme
      ORDER BY question.index NULLS LAST, question.id
    ) AS scheme_stem_index
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.vstudent_ucat_accessible_question_stems accessible
    ON accessible.id = stem.id
  CROSS JOIN context
  WHERE question.deleted_at IS NULL
    AND stem.deleted_at IS NULL
    AND NOT (context.has_online_access AND stem.access_scope = 'public')
), private_counts AS (
  SELECT
    private_question_rows.section_id,
    private_question_rows.question_stem_category_id,
    sum(
      CASE
        WHEN private_question_rows.answer_scheme = 'decision_making_binary_placement'
          AND private_question_rows.scheme_stem_index = 1 THEN 2
        WHEN private_question_rows.answer_scheme = 'decision_making_binary_placement' THEN 0
        ELSE 1
      END
    )::integer AS total_questions
  FROM private_question_rows
  GROUP BY
    private_question_rows.section_id,
    private_question_rows.question_stem_category_id
), combined AS (
  SELECT * FROM cached_public
  UNION ALL
  SELECT * FROM private_counts
)
SELECT
  combined.section_id,
  combined.question_stem_category_id,
  sum(combined.total_questions)::integer AS total_questions
FROM combined
GROUP BY combined.section_id, combined.question_stem_category_id;

GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;

COMMENT ON MATERIALIZED VIEW public.ucat_public_question_counts_cache IS
  'Shared published-public UCAT question denominators; refreshed after catalogue mutations.';
