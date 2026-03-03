-- UCAT: Exclude student-generated sets from set_names in vtutor_ucat_question_stems
-- Tutors should only see staff-created sets in the Sets column on the questions page

DROP VIEW IF EXISTS public.vtutor_ucat_question_stems;
CREATE VIEW public.vtutor_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns AS section_display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  (SELECT COUNT(*)::INT FROM public.ucat_questions q WHERE q.question_stem_id = qs.id) AS question_count,
  (SELECT COALESCE(jsonb_agg(qset.name ORDER BY qset.updated_at DESC NULLS LAST, qset.id), '[]'::jsonb)
   FROM public.question_stems_question_sets qsq
   JOIN public.question_sets qset ON qset.id = qsq.question_set_id
     AND qset.is_student_generated = false
     AND qset.deleted_at IS NULL
   WHERE qsq.question_stem_id = qs.id) AS set_names
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;
