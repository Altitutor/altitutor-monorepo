-- Expose category descriptions to UCAT students for practice/set-generator tooltips.
CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_categories
WITH (security_invoker = false)
AS
SELECT
  qsc.id,
  qsc.name,
  qsc.ucat_section_id,
  qsc.description
FROM public.question_stem_categories qsc
WHERE public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_question_stem_categories TO authenticated;
