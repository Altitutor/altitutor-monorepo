-- ========================
-- UCAT: Add question_stem_count to vtutor_ucat_question_stem_categories and question_count to vtutor_ucat_question_tags
-- ========================

-- vtutor_ucat_question_stem_categories: expose all columns plus question_stem_count
DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_categories;
CREATE VIEW public.vtutor_ucat_question_stem_categories
WITH (security_invoker = false)
AS
SELECT
  qsc.id,
  qsc.name,
  qsc.description,
  qsc.ucat_section_id,
  qsc.parent_question_stem_category_id,
  qsc.created_at,
  qsc.created_by,
  qsc.updated_at,
  qsc.updated_by,
  (SELECT COUNT(*)::int FROM public.question_stems st WHERE st.question_stem_category_id = qsc.id) AS question_stem_count
FROM public.question_stem_categories qsc
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_categories TO authenticated;

-- vtutor_ucat_question_tags: expose all columns plus question_count
DROP VIEW IF EXISTS public.vtutor_ucat_question_tags;
CREATE VIEW public.vtutor_ucat_question_tags
WITH (security_invoker = false)
AS
SELECT
  qt.id,
  qt.name,
  qt.description,
  qt.parent_question_tag_id,
  qt.created_at,
  qt.created_by,
  qt.updated_at,
  qt.updated_by,
  (SELECT COUNT(*)::int FROM public.questions_question_tags qqt WHERE qqt.tag_id = qt.id) AS question_count
FROM public.question_tags qt
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_tags TO authenticated;
