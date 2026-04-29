-- UCAT tutor list filters: stem membership in sets (set_ids) and sets used in mocks (ucat_mock_ids).

-- Dependent views first
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_generated;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_approved;

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
  qs.is_ai_generated,
  qs.ai_generation_metadata,
  qs.approval_status,
  qs.approved_by,
  qs.approved_at,
  approved_staff.first_name AS approved_by_first_name,
  approved_staff.last_name AS approved_by_last_name,
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
   WHERE qsq.question_stem_id = qs.id) AS set_names,
  (SELECT COALESCE(jsonb_agg(qset.id ORDER BY qset.updated_at DESC NULLS LAST, qset.id), '[]'::jsonb)
   FROM public.question_stems_question_sets qsq
   JOIN public.question_sets qset ON qset.id = qsq.question_set_id
     AND qset.is_student_generated = false
     AND qset.deleted_at IS NULL
   WHERE qsq.question_stem_id = qs.id) AS set_ids
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
LEFT JOIN public.staff approved_staff ON approved_staff.id = qs.approved_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;

CREATE VIEW public.vtutor_ucat_question_stems_approved
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE approval_status = 'approved';

GRANT SELECT ON public.vtutor_ucat_question_stems_approved TO authenticated;

CREATE VIEW public.vtutor_ucat_question_stems_generated
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE is_ai_generated = true;

GRANT SELECT ON public.vtutor_ucat_question_stems_generated TO authenticated;

-- Sets list: mocks that reference each set (for /ucat/sets mock filter)
DROP VIEW IF EXISTS public.vtutor_ucat_mock_detail;
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
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::int FROM public.question_stems_question_sets qsq WHERE qsq.question_set_id = qs.id) AS stem_count,
  (
    SELECT COUNT(*)::int
    FROM public.ucat_questions q
    INNER JOIN public.question_stems_question_sets qsq ON qsq.question_stem_id = q.question_stem_id AND qsq.question_set_id = qs.id
  ) AS question_count,
  (
    SELECT COALESCE(jsonb_agg(qsum.ucat_mock_id ORDER BY qsum.index NULLS LAST, qsum.ucat_mock_id), '[]'::jsonb)
    FROM public.question_sets_ucat_mocks qsum
    WHERE qsum.question_set_id = qs.id
  ) AS ucat_mock_ids
FROM public.question_sets qs
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;

CREATE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.instructions_text,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  (
    SELECT json_agg(
      json_build_object(
        'id', vqs.id,
        'name', vqs.name,
        'description', vqs.description,
        'time_limit_seconds', vqs.time_limit_seconds,
        'sections', vqs.sections,
        'question_count', vqs.question_count
      )
      ORDER BY qsum.index
    )
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.vtutor_ucat_question_sets vqs ON vqs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;
