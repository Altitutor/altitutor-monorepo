-- Migration: UCAT student views - expose answer explanations
-- Description: Update vstudent_ucat_question_stem_detail so student-facing
--  question JSON includes question-level and option-level answer_explanation,
--  matching the new ucat_questions.answer_explanation and existing
--  question_answer_options.answer_explanation fields.
-- Author: AI assistant
-- Date: 2026-02-25

-- NOTE:
-- We do NOT touch base tables here (ucat_questions already has answer_explanation).
-- We only update the student-facing view to add new JSON keys. This is backward
-- compatible for existing consumers that ignore the extra keys.

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
              'image_file_id', qao.image_file_id
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

