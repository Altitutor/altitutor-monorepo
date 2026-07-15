DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainer_question_stem_categories"
  ON public.ucat_skill_trainer_question_stem_categories;

CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainer_question_stem_categories"
  ON public.ucat_skill_trainer_question_stem_categories
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));
