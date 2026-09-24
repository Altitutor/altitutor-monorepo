-- Replace the legacy exact/near duplicate queue with one stem-only similarity
-- query. Candidate discovery stays on the small catalog projection and uses a
-- trigram index; full stem/question content is hydrated only after pagination.

DROP FUNCTION IF EXISTS public.tutor_ucat_list_exact_duplicate_stems(
  TEXT, UUID[], INTEGER, INTEGER
);
DROP FUNCTION IF EXISTS public.tutor_ucat_dismiss_exact_duplicate_pair(
  UUID, UUID, TEXT
);
DROP FUNCTION IF EXISTS public.tutor_ucat_merge_exact_duplicate_stems(
  UUID, UUID
);
DROP TABLE IF EXISTS public.ucat_duplicate_pair_dismissals;

DROP INDEX IF EXISTS public.ucat_question_catalog_question_text_fp_idx;

CREATE INDEX IF NOT EXISTS ucat_question_catalog_stem_comparison_trgm_idx
  ON public.ucat_question_catalog_projection
  USING GIN (stem_comparison_text extensions.gin_trgm_ops)
  WHERE stem_comparison_text <> '';

CREATE TABLE public.ucat_duplicate_stem_pairs (
  stem_id_low UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  stem_id_high UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  similarity DOUBLE PRECISION NOT NULL,
  latest_at TIMESTAMPTZ NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stem_id_low, stem_id_high),
  CONSTRAINT ucat_duplicate_stem_pairs_ordered CHECK (stem_id_low < stem_id_high),
  CONSTRAINT ucat_duplicate_stem_pairs_similarity CHECK (similarity >= 0.8 AND similarity <= 1)
);

ALTER TABLE public.ucat_duplicate_stem_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ucat_duplicate_stem_pairs FROM PUBLIC, anon, authenticated;

CREATE INDEX ucat_duplicate_stem_pairs_queue_idx
  ON public.ucat_duplicate_stem_pairs (
    similarity DESC,
    latest_at DESC,
    stem_id_low,
    stem_id_high
  );

CREATE INDEX ucat_duplicate_stem_pairs_section_queue_idx
  ON public.ucat_duplicate_stem_pairs (
    section_id,
    similarity DESC,
    latest_at DESC,
    stem_id_low,
    stem_id_high
  );

CREATE OR REPLACE FUNCTION public.refresh_ucat_duplicate_stem_pairs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_stem_id UUID := COALESCE(NEW.stem_id, OLD.stem_id);
  changed_section_id UUID;
  changed_updated_at TIMESTAMPTZ;
  changed_text TEXT;
  previous_threshold TEXT;
BEGIN
  DELETE FROM public.ucat_duplicate_stem_pairs pair
  WHERE pair.stem_id_low = changed_stem_id OR pair.stem_id_high = changed_stem_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT stem.section_id, stem.updated_at
  INTO changed_section_id, changed_updated_at
  FROM public.question_stems stem
  WHERE stem.id = changed_stem_id AND stem.deleted_at IS NULL;

  changed_text := NEW.stem_comparison_text;
  IF changed_section_id IS NULL OR changed_text = '' THEN
    RETURN NEW;
  END IF;

  previous_threshold := current_setting('pg_trgm.similarity_threshold');
  PERFORM set_config('pg_trgm.similarity_threshold', '0.8', TRUE);

  INSERT INTO public.ucat_duplicate_stem_pairs (
    stem_id_low,
    stem_id_high,
    section_id,
    similarity,
    latest_at
  )
  SELECT
    LEAST(changed_stem_id, other_projection.stem_id),
    GREATEST(changed_stem_id, other_projection.stem_id),
    changed_section_id,
    extensions.similarity(changed_text, other_projection.stem_comparison_text),
    GREATEST(changed_updated_at, other_stem.updated_at)
  FROM public.ucat_question_catalog_projection other_projection
  JOIN public.question_stems other_stem
    ON other_stem.id = other_projection.stem_id
    AND other_stem.deleted_at IS NULL
    AND other_stem.section_id = changed_section_id
  WHERE other_projection.stem_id <> changed_stem_id
    AND other_projection.stem_comparison_text <> ''
    AND other_projection.stem_comparison_text OPERATOR(extensions.%) changed_text
  ON CONFLICT (stem_id_low, stem_id_high)
  DO UPDATE SET
    section_id = EXCLUDED.section_id,
    similarity = EXCLUDED.similarity,
    latest_at = EXCLUDED.latest_at,
    refreshed_at = NOW();

  PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ucat_duplicate_stem_pairs()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER refresh_ucat_duplicate_stem_pairs
AFTER INSERT OR UPDATE OF stem_comparison_text OR DELETE
ON public.ucat_question_catalog_projection
FOR EACH ROW
EXECUTE FUNCTION public.refresh_ucat_duplicate_stem_pairs();

-- Backfill the maintained pair projection for existing stems.
UPDATE public.ucat_question_catalog_projection
SET stem_comparison_text = stem_comparison_text
WHERE stem_comparison_text <> '';

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_duplicate_stem_pairs(
  p_search TEXT DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.95,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  safe_threshold DOUBLE PRECISION := LEAST(
    GREATEST(COALESCE(p_similarity_threshold, 0.95), 0.8),
    1.0
  );
  safe_search TEXT := LOWER(BTRIM(COALESCE(p_search, '')));
  safe_like_search TEXT := REPLACE(
    REPLACE(REPLACE(LOWER(BTRIM(COALESCE(p_search, ''))), E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT
      pair.stem_id_low AS stem_id_a,
      pair.stem_id_high AS stem_id_b,
      pair.section_id,
      section.name AS section_name,
      pair.similarity AS similarity_score,
      pair.latest_at
    FROM public.ucat_duplicate_stem_pairs pair
    JOIN public.ucat_sections section
      ON section.id = pair.section_id
    JOIN public.ucat_question_catalog_projection left_projection
      ON left_projection.stem_id = pair.stem_id_low
    JOIN public.ucat_question_catalog_projection right_projection
      ON right_projection.stem_id = pair.stem_id_high
    WHERE pair.similarity >= safe_threshold
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR pair.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR left_projection.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR right_projection.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(section.name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  ranked AS (
    SELECT
      candidates.*,
      COUNT(*) OVER () AS total_count,
      ROW_NUMBER() OVER (
        ORDER BY similarity_score DESC, latest_at DESC NULLS LAST, stem_id_a, stem_id_b
      ) AS ordinal
    FROM candidates
  ),
  page_pairs AS (
    SELECT *
    FROM ranked
    WHERE ordinal > (safe_page - 1) * safe_page_size
      AND ordinal <= safe_page * safe_page_size
  ),
  hydrated AS (
    SELECT
      pair.*,
      left_detail.section_id AS left_section_id,
      left_detail.section_name AS left_section_name,
      left_detail.question_stem_category_id AS left_category_id,
      left_detail.category_name AS left_category_name,
      left_detail.stem_text AS left_stem_text,
      COALESCE(left_detail.questions, '[]'::JSON) AS left_questions,
      right_detail.section_id AS right_section_id,
      right_detail.section_name AS right_section_name,
      right_detail.question_stem_category_id AS right_category_id,
      right_detail.category_name AS right_category_name,
      right_detail.stem_text AS right_stem_text,
      COALESCE(right_detail.questions, '[]'::JSON) AS right_questions,
      left_stem.access_scope::TEXT = 'private' AS left_private,
      right_stem.access_scope::TEXT = 'private' AS right_private,
      left_projection.set_names AS left_set_names,
      right_projection.set_names AS right_set_names
    FROM page_pairs pair
    JOIN public.vtutor_ucat_question_stem_detail left_detail
      ON left_detail.id = pair.stem_id_a
    JOIN public.vtutor_ucat_question_stem_detail right_detail
      ON right_detail.id = pair.stem_id_b
    JOIN public.question_stems left_stem
      ON left_stem.id = pair.stem_id_a
    JOIN public.question_stems right_stem
      ON right_stem.id = pair.stem_id_b
    JOIN public.ucat_question_catalog_projection left_projection
      ON left_projection.stem_id = pair.stem_id_a
    JOIN public.ucat_question_catalog_projection right_projection
      ON right_projection.stem_id = pair.stem_id_b
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', stem_id_a::TEXT || ':' || stem_id_b::TEXT,
          'sectionId', section_id,
          'sectionName', section_name,
          'similarity', ROUND(similarity_score::NUMERIC, 4),
          'stemA', JSONB_BUILD_OBJECT(
            'id', stem_id_a,
            'sectionId', left_section_id,
            'sectionName', left_section_name,
            'categoryId', left_category_id,
            'categoryName', left_category_name,
            'stemText', left_stem_text,
            'isPrivate', left_private,
            'setNames', left_set_names,
            'questions', left_questions
          ),
          'stemB', JSONB_BUILD_OBJECT(
            'id', stem_id_b,
            'sectionId', right_section_id,
            'sectionName', right_section_name,
            'categoryId', right_category_id,
            'categoryName', right_category_name,
            'stemText', right_stem_text,
            'isPrivate', right_private,
            'setNames', right_set_names,
            'questions', right_questions
          )
        )
        ORDER BY ordinal
      ),
      '[]'::JSONB
    ),
    'total', COALESCE(MAX(total_count), 0),
    'page', safe_page,
    'pageSize', safe_page_size,
    'similarityThreshold', safe_threshold
  )
  INTO result
  FROM hydrated;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_duplicate_stem_pairs(
  TEXT, UUID[], DOUBLE PRECISION, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_duplicate_stem_pairs(
  TEXT, UUID[], DOUBLE PRECISION, INTEGER, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_merge_duplicate_stem_pair(
  p_target_stem_id UUID,
  p_source_stem_id UUID,
  p_minimum_similarity DOUBLE PRECISION DEFAULT 0.95
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_projection public.ucat_question_catalog_projection%ROWTYPE;
  source_projection public.ucat_question_catalog_projection%ROWTYPE;
  target_section_id UUID;
  source_section_id UUID;
  safe_threshold DOUBLE PRECISION := LEAST(
    GREATEST(COALESCE(p_minimum_similarity, 0.95), 0.8),
    1.0
  );
  source_question RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;
  IF p_target_stem_id IS NULL
    OR p_source_stem_id IS NULL
    OR p_target_stem_id = p_source_stem_id
  THEN
    RAISE EXCEPTION 'Two different question stems are required';
  END IF;

  SELECT projection.*
  INTO target_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_target_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  SELECT stem.section_id INTO target_section_id
  FROM public.question_stems stem
  WHERE stem.id = p_target_stem_id AND stem.deleted_at IS NULL;

  SELECT projection.*
  INTO source_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_source_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  SELECT stem.section_id INTO source_section_id
  FROM public.question_stems stem
  WHERE stem.id = p_source_stem_id AND stem.deleted_at IS NULL;

  IF target_projection.stem_id IS NULL OR source_projection.stem_id IS NULL THEN
    RAISE EXCEPTION 'Question stem not found';
  END IF;
  IF target_section_id <> source_section_id
    OR target_projection.stem_comparison_text = ''
    OR source_projection.stem_comparison_text = ''
    OR extensions.similarity(
      target_projection.stem_comparison_text,
      source_projection.stem_comparison_text
    ) < safe_threshold
  THEN
    RAISE EXCEPTION 'The stems no longer meet the duplicate similarity threshold';
  END IF;

  FOR source_question IN
    SELECT source.id
    FROM public.ucat_questions source
    WHERE source.question_stem_id = p_source_stem_id
      AND source.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.ucat_questions target
        WHERE target.question_stem_id = p_target_stem_id
          AND target.deleted_at IS NULL
          AND target.response_type = source.response_type
          AND target.answer_scheme = source.answer_scheme
          AND public.canonical_ucat_catalog_rich_text(target.question_text)
            = public.canonical_ucat_catalog_rich_text(source.question_text)
      )
  LOOP
    UPDATE public.question_answer_options
    SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
    WHERE question_id = source_question.id AND deleted_at IS NULL;

    UPDATE public.ucat_questions
    SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
    WHERE id = source_question.id;
  END LOOP;

  PERFORM public.tutor_ucat_merge_question_stems(
    p_target_stem_id,
    p_source_stem_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_merge_duplicate_stem_pair(
  UUID, UUID, DOUBLE PRECISION
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_merge_duplicate_stem_pair(
  UUID, UUID, DOUBLE PRECISION
) TO authenticated;
