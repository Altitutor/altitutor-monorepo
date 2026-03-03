-- UCAT: Add option selection stats to vstudent_ucat_question_stem_detail
-- For each answer option: selection_count, total_answered, percentage
-- Used in answer review mode to show "X% of students chose this option"
-- Aggregates from student_question_attempts (is_submitted = true, has answer)

DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;
CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  us.instructions_text AS section_instructions_text,
  us.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  us.time_limit_seconds AS section_time_limit_seconds,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'answer_explanation', q.answer_explanation,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'selection_count', (
                SELECT COUNT(*)::int
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id = qao.id
                  AND sqa.is_submitted = true
              ),
              'total_answered', (
                SELECT COUNT(*)::int
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id IS NOT NULL
                  AND sqa.is_submitted = true
              ),
              'percentage', COALESCE(
                ROUND(
                  100.0 * (
                    SELECT COUNT(*)::numeric
                    FROM public.student_question_attempts sqa
                    WHERE sqa.question_id = q.id
                      AND sqa.question_answer_option_id = qao.id
                      AND sqa.is_submitted = true
                  ) / NULLIF((
                    SELECT COUNT(*)::numeric
                    FROM public.student_question_attempts sqa
                    WHERE sqa.question_id = q.id
                      AND sqa.question_answer_option_id IS NOT NULL
                      AND sqa.is_submitted = true
                  ), 0),
                  1
                ),
                0
              )
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id AND qao.deleted_at IS NULL
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id AND q.deleted_at IS NULL
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;
