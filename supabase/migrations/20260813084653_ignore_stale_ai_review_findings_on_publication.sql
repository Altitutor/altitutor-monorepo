-- Tutor-web treats an AI review as absent once the review contract version
-- changes. Publication previously still blocked on those stale findings, so a
-- stem could show "AI review not requested" and still be unpublishable.
-- Keep this integer in sync with AI_ASSESSMENT_PROMPT_VERSION in
-- apps/tutor-web/src/features/ucat/questions/lib/ai-assessment/schema.ts.

CREATE OR REPLACE FUNCTION public.ucat_current_ai_assessment_prompt_version()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 18;
$$;

COMMENT ON FUNCTION public.ucat_current_ai_assessment_prompt_version() IS
  'Current tutor-web AI assessment prompt version. Must match AI_ASSESSMENT_PROMPT_VERSION.';

REVOKE ALL ON FUNCTION public.ucat_current_ai_assessment_prompt_version()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_unresolved_current_ai_assessment_findings(
  p_stem_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH current_scope AS (
    SELECT public.ucat_ai_current_shared_fingerprint(p_stem_id) AS shared_fingerprint
  ),
  candidate_findings AS (
    SELECT
      run.id AS run_id,
      run.requested_at,
      finding.value AS finding,
      finding.value->>'scopeType' AS scope_type,
      NULLIF(finding.value->>'questionId', '')::UUID AS question_id
    FROM public.ucat_ai_question_assessment_cycles cycle
    JOIN public.ucat_ai_question_assessment_runs run
      ON run.cycle_id = cycle.id
    CROSS JOIN current_scope
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(run.assessment_result->'findings', '[]'::JSONB)
    ) AS finding(value)
    WHERE cycle.stem_id = p_stem_id
      AND cycle.is_current = TRUE
      AND run.status = 'completed'
      AND run.prompt_version = public.ucat_current_ai_assessment_prompt_version()
      AND (
        (
          finding.value->>'scopeType' = 'shared'
          AND run.scope_type = 'full'
          AND run.shared_fingerprint = current_scope.shared_fingerprint
        )
        OR
        (
          finding.value->>'scopeType' = 'question'
          AND NULLIF(finding.value->>'questionId', '') IS NOT NULL
          AND (NULLIF(finding.value->>'questionId', '')::UUID = ANY(run.target_question_ids))
          AND run.question_fingerprints->>(finding.value->>'questionId')
            = public.ucat_ai_current_question_fingerprint(
                NULLIF(finding.value->>'questionId', '')::UUID
              )
        )
      )
  ),
  effective_findings AS (
    SELECT candidate.*
    FROM candidate_findings candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.ucat_ai_question_assessment_cycles newer_cycle
      JOIN public.ucat_ai_question_assessment_runs newer
        ON newer.cycle_id = newer_cycle.id
      CROSS JOIN current_scope
      WHERE newer_cycle.stem_id = p_stem_id
        AND newer_cycle.is_current = TRUE
        AND newer.prompt_version = public.ucat_current_ai_assessment_prompt_version()
        AND (newer.requested_at, newer.id) > (candidate.requested_at, candidate.run_id)
        AND (
          (
            candidate.scope_type = 'shared'
            AND newer.scope_type = 'full'
            AND newer.shared_fingerprint = current_scope.shared_fingerprint
          )
          OR
          (
            candidate.scope_type = 'question'
            AND candidate.question_id = ANY(newer.target_question_ids)
            AND newer.question_fingerprints->>candidate.question_id::TEXT
              = public.ucat_ai_current_question_fingerprint(candidate.question_id)
          )
        )
    )
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'code', 'unresolved_ai_review_finding',
      'message', 'Resolve the current AI review finding before publishing.',
      'entity_type', 'stem',
      'entity_id', p_stem_id,
      'assessment_run_id', effective.run_id,
      'finding_key', effective.finding->>'key',
      'question_id', effective.question_id,
      'review_dimension', effective.finding->>'category',
      'title', effective.finding->>'title'
    ) ORDER BY effective.requested_at, effective.finding->>'key'),
    '[]'::JSONB
  )
  FROM effective_findings effective
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ucat_ai_question_assessment_decisions decision
    WHERE decision.run_id = effective.run_id
      AND decision.finding_key = effective.finding->>'key'
  );
$$;

COMMENT ON FUNCTION public.ucat_unresolved_current_ai_assessment_findings(UUID) IS
  'Returns unresolved findings only from the effective current-contract AI assessment run for each exact current stem/question scope. Missing, failed, stale, superseded, older prompt versions, and duplicate reviews are ignored.';
