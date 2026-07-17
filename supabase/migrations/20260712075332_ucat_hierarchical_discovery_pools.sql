-- Keep access and discovery separate:
-- - accessible stems remain available through direct links, assigned resources,
--   sets, mocks, learning modules, and attempt history;
-- - the public practice picker only discovers stems that are not reserved by an
--   active staff-authored set;
-- - the sets library only discovers sets that are not reserved by an active mock.

CREATE OR REPLACE VIEW public.vstudent_ucat_question_stems
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
  NOT EXISTS (
    SELECT 1
    FROM public.question_stems_question_sets qsq
    JOIN public.question_sets qset
      ON qset.id = qsq.question_set_id
      AND qset.is_student_generated = false
      AND qset.deleted_at IS NULL
    WHERE qsq.question_stem_id = qs.id
  ) AS is_available_for_practice
FROM public.question_stems qs
JOIN public.vstudent_ucat_accessible_question_stems aqs
  ON aqs.id = qs.id
JOIN public.ucat_sections us
  ON us.id = qs.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stems TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at,
  (
    qs.is_student_generated = true
    OR NOT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks qsum
      JOIN public.ucat_mocks mock
        ON mock.id = qsum.ucat_mock_id
        AND mock.deleted_at IS NULL
      WHERE qsum.question_set_id = qs.id
    )
  ) AS is_available_in_sets_library
FROM public.question_sets qs
JOIN public.vstudent_ucat_accessible_question_sets aqs
  ON aqs.id = qs.id;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;
