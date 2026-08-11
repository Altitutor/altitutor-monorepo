-- Canonical evidence for the Student-facing Altitutor practice estimate.
-- Learning-only work remains visible to the Preparation engine, but the pure
-- score model is solely responsible for deciding whether a row qualifies.

ALTER TABLE public.question_sets
  ADD COLUMN score_evidence_standardised BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.question_sets.score_evidence_standardised IS
  'True only for controlled partial forms approved for the active representative-score composition policy.';

DROP VIEW public.vstudent_ucat_score_projection_evidence;

CREATE VIEW public.vstudent_ucat_score_projection_evidence
WITH (security_invoker = false)
AS
SELECT
  timing.evidence_session_id,
  timing.source,
  timing.section_id,
  section.section_number,
  timing.completed_at,
  attempt.scaled_score,
  attempt.score_points,
  attempt.total_points,
  round(timing.section_equivalents * section.number_of_questions)::INTEGER
    AS question_count,
  section.number_of_questions AS section_question_count,
  attempt.was_timed,
  timing.prescribed_pace,
  timing.observed_pace,
  timing.breadth,
  true AS feedback_withheld,
  false AS is_student_generated,
  CASE
    WHEN timing.source = 'mock' THEN true
    ELSE question_set.score_evidence_standardised
  END AS is_standardised
FROM public.vstudent_ucat_preparation_timing_evidence timing
JOIN public.student_question_set_attempts attempt
  ON attempt.id::TEXT = timing.evidence_session_id
JOIN public.question_sets question_set ON question_set.id = attempt.question_set_id
JOIN public.ucat_sections section ON section.id = timing.section_id
WHERE timing.source IN ('set', 'mock')

UNION ALL

SELECT
  timing.evidence_session_id,
  timing.source,
  timing.section_id,
  section.section_number,
  timing.completed_at,
  NULL::NUMERIC AS scaled_score,
  practice.score_points,
  practice.total_points,
  round(timing.section_equivalents * section.number_of_questions)::INTEGER
    AS question_count,
  section.number_of_questions AS section_question_count,
  practice.was_timed,
  timing.prescribed_pace,
  timing.observed_pace,
  timing.breadth,
  false AS feedback_withheld,
  true AS is_student_generated,
  false AS is_standardised
FROM public.vstudent_ucat_preparation_timing_evidence timing
JOIN public.student_practice_sessions practice
  ON practice.id::TEXT = timing.evidence_session_id
JOIN public.ucat_sections section ON section.id = timing.section_id
WHERE timing.source = 'practice';

REVOKE ALL ON public.vstudent_ucat_score_projection_evidence
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_score_projection_evidence
  TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_score_projection_evidence IS
  'Current-Student score evidence with timing, composition, feedback and provenance metadata. The versioned Preparation score model classifies each row as representative full, representative partial or learning-only.';

ALTER TABLE public.ucat_score_projection_snapshots
  ADD COLUMN model_version TEXT NOT NULL DEFAULT 'legacy-score-projection-v1';

ALTER TABLE public.ucat_score_projection_snapshots
  DROP CONSTRAINT ucat_score_projection_snapshots_student_date_key,
  ADD CONSTRAINT ucat_score_projection_snapshots_model_version_check
    CHECK (length(trim(model_version)) > 0),
  ADD CONSTRAINT ucat_score_projection_snapshots_student_date_model_key
    UNIQUE (student_id, snapshot_date, model_version);

DROP INDEX public.ucat_score_projection_snapshots_student_history_idx;
CREATE INDEX ucat_score_projection_snapshots_student_history_idx
  ON public.ucat_score_projection_snapshots
    (student_id, model_version, snapshot_date DESC);

COMMENT ON COLUMN public.ucat_score_projection_snapshots.model_version IS
  'Immutable score-model version for this snapshot; consumers must never combine histories across versions.';
