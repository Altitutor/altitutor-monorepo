-- Fix: student question progress was always empty for authenticated students.
-- vstudent_ucat_my_question_progress used security_invoker=true, so its join to
-- ucat_questions ran as the student. Students have no SELECT on ucat_questions
-- (RLS), so the join dropped every row while public question denominators (from a
-- security_invoker=false view) still rendered — producing "0 / N" totals.
-- Align with sibling student progress views and keep student scoping via
-- vstudent_ucat_my_question_attempts (auth.uid() → current student).

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_progress
WITH (security_invoker = false)
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

GRANT SELECT ON public.vstudent_ucat_my_question_progress TO authenticated;
