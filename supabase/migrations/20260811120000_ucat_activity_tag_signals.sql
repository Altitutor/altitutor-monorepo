-- Student-scoped tag evidence for weak sampling bias. Inventory is counted
-- only from stems the current Student can actually access; historical
-- attempts contribute evidence without exposing another Student's rows.

CREATE VIEW public.vstudent_ucat_activity_tag_signals
WITH (security_invoker = false)
AS
WITH accessible_inventory AS (
  SELECT
    tag.id AS tag_id,
    tag.ucat_section_id AS section_id,
    stem.question_stem_category_id AS category_id,
    count(DISTINCT question.id)::INTEGER AS available_question_count
  FROM public.question_tags tag
  JOIN public.questions_question_tags link ON link.tag_id = tag.id
  JOIN public.ucat_questions question
    ON question.id = link.question_id
   AND question.deleted_at IS NULL
  JOIN public.question_stems stem
    ON stem.id = question.question_stem_id
   AND stem.deleted_at IS NULL
   AND stem.status = 'published'
  JOIN public.vstudent_ucat_accessible_question_stems accessible
    ON accessible.id = stem.id
  WHERE tag.ucat_section_id IS NOT NULL
    AND stem.question_stem_category_id IS NOT NULL
  GROUP BY tag.id, tag.ucat_section_id, stem.question_stem_category_id
), current_student_evidence AS (
  SELECT
    link.tag_id,
    stem.question_stem_category_id AS category_id,
    count(DISTINCT coalesce(
      'practice:' || attempt.student_practice_session_id::TEXT,
      'set:' || attempt.student_question_set_attempt_id::TEXT,
      'attempt:' || attempt.id::TEXT
    ))::INTEGER AS independent_session_count,
    avg(CASE WHEN attempt.score > 0 THEN 0::NUMERIC ELSE 1::NUMERIC END)
      AS weakness_score
  FROM public.student_question_attempts attempt
  JOIN public.ucat_questions question ON question.id = attempt.question_id
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.questions_question_tags link ON link.question_id = question.id
  WHERE attempt.student_id = (SELECT public.current_student_id())
    AND attempt.is_submitted
  GROUP BY link.tag_id, stem.question_stem_category_id
)
SELECT
  inventory.tag_id,
  inventory.section_id,
  inventory.category_id,
  inventory.available_question_count,
  coalesce(evidence.independent_session_count, 0)::INTEGER
    AS independent_session_count,
  coalesce(evidence.weakness_score, 0.5)::NUMERIC AS weakness_score
FROM accessible_inventory inventory
LEFT JOIN current_student_evidence evidence
  ON evidence.tag_id = inventory.tag_id
 AND evidence.category_id = inventory.category_id;

REVOKE ALL ON public.vstudent_ucat_activity_tag_signals
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_activity_tag_signals
  TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_activity_tag_signals IS
  'Current-Student tag evidence and accessible approved-question inventory for weak activity sampling bias.';
