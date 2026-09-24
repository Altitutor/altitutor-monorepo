-- Let the score model pool complementary controlled Sets instead of relying on
-- a manual per-Set standardisation override. Also expose question tags on the
-- lightweight Student practice index so module-linked practice can rank whole
-- stems without loading rich delivery payloads.

DROP VIEW public.vstudent_ucat_score_projection_evidence;

ALTER TABLE public.question_sets
  DROP COLUMN score_evidence_standardised;

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
  (
    SELECT count(*)::INTEGER
    FROM public.question_stem_categories category
    WHERE category.ucat_section_id = timing.section_id
  ) AS section_category_count,
  attempt.was_timed,
  timing.prescribed_pace,
  timing.observed_pace,
  timing.breadth,
  timing.category_ids,
  true AS feedback_withheld,
  false AS is_student_generated
FROM public.vstudent_ucat_preparation_timing_evidence timing
JOIN public.student_question_set_attempts attempt
  ON attempt.id::TEXT = timing.evidence_session_id
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
  (
    SELECT count(*)::INTEGER
    FROM public.question_stem_categories category
    WHERE category.ucat_section_id = timing.section_id
  ) AS section_category_count,
  practice.was_timed,
  timing.prescribed_pace,
  timing.observed_pace,
  timing.breadth,
  timing.category_ids,
  false AS feedback_withheld,
  true AS is_student_generated
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
  'Current-Student controlled score evidence. The versioned score model pools eligible 1.0x Set evidence and judges aggregate dose and category breadth.';

DROP VIEW public.vstudent_ucat_practice_stem_index;
CREATE VIEW public.vstudent_ucat_practice_stem_index
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  stem.question_stem_category_id,
  ARRAY(
    SELECT question.id
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
    ORDER BY question.index
  ) AS question_ids,
  ARRAY(
    SELECT DISTINCT link.tag_id
    FROM public.ucat_questions question
    JOIN public.questions_question_tags link ON link.question_id = question.id
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
    ORDER BY link.tag_id
  ) AS question_tag_ids
FROM public.vstudent_ucat_question_stems stem
WHERE stem.is_available_for_practice = true;

GRANT SELECT ON public.vstudent_ucat_practice_stem_index TO authenticated;
