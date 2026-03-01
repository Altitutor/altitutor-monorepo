-- Add stem_count and question_count to vtutor_ucat_question_sets for list display
DROP VIEW IF EXISTS public.vtutor_ucat_question_sets;
CREATE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::int FROM public.question_stems_question_sets qsq WHERE qsq.question_set_id = qs.id) AS stem_count,
  (
    SELECT COUNT(*)::int
    FROM public.ucat_questions q
    INNER JOIN public.question_stems_question_sets qsq ON qsq.question_stem_id = q.question_stem_id AND qsq.question_set_id = qs.id
  ) AS question_count
FROM public.question_sets qs
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;
