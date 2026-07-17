DROP INDEX IF EXISTS public.idx_skill_trainer_study_categories_trainer;

CREATE INDEX IF NOT EXISTS idx_skill_trainer_study_categories_created_by
  ON public.ucat_skill_trainer_question_stem_categories (created_by)
  WHERE created_by IS NOT NULL;
