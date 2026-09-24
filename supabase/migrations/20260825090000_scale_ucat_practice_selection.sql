-- Keep practice selection bounded at the API boundary. PostgREST applies a
-- project-wide row cap, so catalogue and attempt rows must be reduced inside
-- Postgres rather than downloaded and joined by the Next.js server.

CREATE INDEX IF NOT EXISTS idx_ucat_learning_module_blocks_active_stem
  ON public.ucat_learning_module_blocks (question_stem_id, learning_module_id)
  WHERE deleted_at IS NULL AND question_stem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ucat_learning_module_blocks_active_question
  ON public.ucat_learning_module_blocks (question_id, learning_module_id)
  WHERE deleted_at IS NULL AND question_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_question_attempts_student_question_submitted
  ON public.student_question_attempts (student_id, question_id)
  INCLUDE (score)
  WHERE is_submitted = true;

-- Resolve learning-module stem membership once per statement. The previous
-- correlated OR scanned module blocks once for every published stem.
CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_stems
WITH (security_invoker = false)
AS
WITH learning_stems AS MATERIALIZED (
  SELECT block.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  WHERE block.deleted_at IS NULL AND block.question_stem_id IS NOT NULL
  UNION
  SELECT question.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN public.ucat_questions question
    ON question.id = block.question_id AND question.deleted_at IS NULL
  WHERE block.deleted_at IS NULL AND block.question_id IS NOT NULL
)
SELECT stem.id
FROM public.question_stems stem
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND (
    (ctx.has_online_access AND stem.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_stems_question_sets member
        ON member.question_set_id = resource.question_set_id
      WHERE member.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_sets_ucat_mocks mock_member
        ON mock_member.ucat_mock_id = resource.ucat_mock_id
      JOIN public.question_stems_question_sets stem_member
        ON stem_member.question_set_id = mock_member.question_set_id
      WHERE stem_member.question_stem_id = stem.id
    )
    OR EXISTS (SELECT 1 FROM learning_stems learning WHERE learning.id = stem.id)
  );

CREATE OR REPLACE FUNCTION public.get_student_ucat_practice_candidates(
  p_section_id uuid,
  p_category_ids uuid[] DEFAULT NULL,
  p_question_tag_ids uuid[] DEFAULT NULL,
  p_unanswered_only boolean DEFAULT false,
  p_incorrect_only boolean DEFAULT false,
  p_exclude_stem_ids uuid[] DEFAULT NULL,
  p_deterministic boolean DEFAULT false,
  p_candidates_per_tier integer DEFAULT 256
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH stem_rows AS (
    SELECT
      stem.id,
      stem.section_id,
      stem.question_stem_category_id,
      stem.question_ids,
      coalesce(stem.question_tag_ids, ARRAY[]::uuid[]) AS question_tag_ids
    FROM public.vstudent_ucat_practice_stem_index stem
    WHERE stem.section_id = p_section_id
      AND (
        coalesce(cardinality(p_category_ids), 0) = 0
        OR stem.question_stem_category_id = ANY (p_category_ids)
      )
      AND NOT (stem.id = ANY (coalesce(p_exclude_stem_ids, ARRAY[]::uuid[])))
  ), relevant_questions AS (
    SELECT stem.id AS stem_id, question_id
    FROM stem_rows stem
    CROSS JOIN LATERAL unnest(stem.question_ids) question_id
  ), submitted_status AS (
    SELECT
      attempt.question_id,
      bool_or(coalesce(attempt.score, 0) > 0) AS any_correct
    FROM public.vstudent_ucat_my_question_attempts attempt
    JOIN relevant_questions relevant ON relevant.question_id = attempt.question_id
    WHERE attempt.is_submitted = true
      AND (
        p_unanswered_only
        OR p_incorrect_only
        OR coalesce(cardinality(p_question_tag_ids), 0) > 0
      )
    GROUP BY attempt.question_id
  ), aggregates AS (
    SELECT
      stem.id,
      stem.section_id,
      stem.question_stem_category_id,
      stem.question_ids,
      stem.question_tag_ids,
      count(relevant.question_id)::integer AS question_count,
      count(relevant.question_id) FILTER (
        WHERE CASE
          WHEN p_unanswered_only THEN status.question_id IS NULL
          WHEN p_incorrect_only THEN status.question_id IS NOT NULL AND NOT status.any_correct
          ELSE true
        END
      )::integer AS matching_question_count,
      CASE
        WHEN bool_and(status.question_id IS NULL) THEN
          CASE WHEN stem.question_tag_ids && coalesce(p_question_tag_ids, ARRAY[]::uuid[])
            THEN 0 ELSE 1 END
        WHEN stem.question_tag_ids && coalesce(p_question_tag_ids, ARRAY[]::uuid[])
          AND bool_or(status.question_id IS NOT NULL AND NOT status.any_correct)
          THEN 2
        ELSE 3
      END AS fallback_tier,
      ARRAY(
        SELECT tag_id
        FROM unnest(stem.question_tag_ids) tag_id
        WHERE tag_id = ANY (coalesce(p_question_tag_ids, ARRAY[]::uuid[]))
        ORDER BY tag_id
      ) AS matched_tag_ids
    FROM stem_rows stem
    JOIN relevant_questions relevant ON relevant.stem_id = stem.id
    LEFT JOIN submitted_status status ON status.question_id = relevant.question_id
    GROUP BY
      stem.id,
      stem.section_id,
      stem.question_stem_category_id,
      stem.question_ids,
      stem.question_tag_ids
  ), eligible AS (
    SELECT *
    FROM aggregates
    WHERE question_count > 0 AND matching_question_count > 0
  ), ranked AS (
    SELECT
      eligible.*,
      row_number() OVER (
        PARTITION BY fallback_tier
        ORDER BY
          CASE WHEN p_deterministic THEN eligible.id::text END,
          CASE WHEN NOT p_deterministic THEN random() END
      ) AS tier_rank
    FROM eligible
  ), totals AS (
    SELECT coalesce(sum(matching_question_count), 0)::integer AS total
    FROM eligible
  ), candidates AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.id,
          'section_id', ranked.section_id,
          'question_stem_category_id', ranked.question_stem_category_id,
          'question_ids', ranked.question_ids,
          'question_tag_ids', ranked.question_tag_ids,
          'question_count', ranked.question_count,
          'matching_question_count', ranked.matching_question_count,
          'fallback_tier', ranked.fallback_tier,
          'matched_tag_ids', ranked.matched_tag_ids
        )
        ORDER BY ranked.fallback_tier, ranked.tier_rank
      ),
      '[]'::jsonb
    ) AS rows
    FROM ranked
    WHERE ranked.tier_rank <= greatest(1, least(p_candidates_per_tier, 512))
  )
  SELECT jsonb_build_object(
    'total_matching_questions', totals.total,
    'candidates', candidates.rows
  )
  FROM totals CROSS JOIN candidates;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_practice_candidates(
  uuid, uuid[], uuid[], boolean, boolean, uuid[], boolean, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_practice_candidates(
  uuid, uuid[], uuid[], boolean, boolean, uuid[], boolean, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_student_ucat_practice_questions(
  p_section_id uuid,
  p_category_ids uuid[] DEFAULT NULL,
  p_unanswered_only boolean DEFAULT false,
  p_incorrect_only boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(
    (
      public.get_student_ucat_practice_candidates(
        p_section_id,
        p_category_ids,
        NULL,
        p_unanswered_only,
        p_incorrect_only,
        NULL,
        true,
        1
      ) ->> 'total_matching_questions'
    )::integer,
    0
  );
$$;

REVOKE ALL ON FUNCTION public.count_student_ucat_practice_questions(
  uuid, uuid[], boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_student_ucat_practice_questions(
  uuid, uuid[], boolean, boolean
) TO authenticated;

COMMENT ON FUNCTION public.get_student_ucat_practice_candidates(
  uuid, uuid[], uuid[], boolean, boolean, uuid[], boolean, integer
) IS 'Returns a global match count and a bounded, tier-balanced practice candidate pool in one PostgREST row.';
