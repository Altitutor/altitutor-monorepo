-- UCAT: Add vstudent_ucat_public_question_counts view
-- Description: Total public question "points" per section and category for progress display.
-- Uses same scoring as progress: syllogism stem = 2, else = 1.
-- Date: 2026-03-16

CREATE OR REPLACE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH stem_scores AS (
  SELECT
    st.id,
    st.section_id,
    st.question_stem_category_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.ucat_questions q
        WHERE q.question_stem_id = st.id
          AND q.question_type = 'syllogism'
          AND q.deleted_at IS NULL
      ) THEN 2
      ELSE 1
    END AS max_score
  FROM public.question_stems st
  WHERE st.is_private = false
    AND st.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.ucat_questions q
      WHERE q.question_stem_id = st.id
        AND q.deleted_at IS NULL
    )
)
SELECT
  section_id,
  question_stem_category_id,
  SUM(max_score)::int AS total_questions
FROM stem_scores
GROUP BY section_id, question_stem_category_id;

GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;
