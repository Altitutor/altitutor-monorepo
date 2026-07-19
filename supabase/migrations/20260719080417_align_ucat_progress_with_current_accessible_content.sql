-- Keep progress-card numerators on the same current, accessible content pool as
-- their denominators. Historical attempts remain available from the attempt
-- history views, but deleted or inaccessible content no longer inflates
-- completion totals.

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_progress
WITH (security_invoker = true)
AS
WITH ranked_attempts AS (
  SELECT
    attempt.question_id,
    attempt.question_stem_id,
    attempt.question_type,
    attempt.ucat_section_id,
    attempt.question_stem_category_id,
    attempt.score,
    row_number() OVER (
      PARTITION BY attempt.question_id
      ORDER BY attempt.score DESC NULLS LAST, attempt.attempted_at DESC, attempt.id DESC
    ) AS question_rank
  FROM public.vstudent_ucat_my_question_attempts attempt
  JOIN public.ucat_questions current_question
    ON current_question.id = attempt.question_id
   AND current_question.deleted_at IS NULL
  JOIN public.vstudent_ucat_accessible_question_stems accessible_stem
    ON accessible_stem.id = current_question.question_stem_id
  WHERE attempt.is_submitted
), best_attempts AS (
  SELECT
    ranked.question_id,
    ranked.question_stem_id,
    ranked.question_type,
    ranked.ucat_section_id,
    ranked.question_stem_category_id,
    ranked.score,
    row_number() OVER (
      PARTITION BY ranked.ucat_section_id, ranked.question_stem_id
      ORDER BY ranked.question_id
    ) AS stem_question_rank
  FROM ranked_attempts ranked
  WHERE ranked.question_rank = 1
)
SELECT
  best.ucat_section_id AS section_id,
  best.question_stem_category_id AS category_id,
  COALESCE(sum(best.score), 0)::INTEGER AS correct_score,
  sum(CASE
    WHEN best.question_type = 'syllogism' THEN CASE WHEN best.stem_question_rank = 1 THEN 2 ELSE 0 END
    ELSE 1
  END)::INTEGER AS max_score
FROM best_attempts best
WHERE best.ucat_section_id IS NOT NULL
GROUP BY best.ucat_section_id, best.question_stem_category_id;

CREATE OR REPLACE VIEW public.vstudent_ucat_section_set_progress
WITH (security_invoker = false)
AS
SELECT
  section.id AS section_id,
  count(DISTINCT attempt.question_set_id)::INTEGER AS total_completed,
  count(DISTINCT attempt.question_set_id) FILTER (WHERE NOT attempt.was_timed)::INTEGER AS untimed_completed,
  count(DISTINCT attempt.question_set_id) FILTER (WHERE attempt.was_timed)::INTEGER AS timed_completed
FROM public.student_question_set_attempts attempt
JOIN public.vstudent_ucat_accessible_question_sets accessible_set
  ON accessible_set.id = attempt.question_set_id
JOIN public.question_sets current_set
  ON current_set.id = accessible_set.id
JOIN public.ucat_sections section
  ON section.section_number = nullif(
    current_set.sections -> 0 ->> 'section_number',
    ''
  )::INTEGER
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
GROUP BY section.id;

GRANT SELECT ON public.vstudent_ucat_my_question_progress TO authenticated;
GRANT SELECT ON public.vstudent_ucat_section_set_progress TO authenticated;
