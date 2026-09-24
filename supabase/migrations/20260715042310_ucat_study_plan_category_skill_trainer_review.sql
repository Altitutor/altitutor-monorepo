-- Category-aware Study plan warm-ups.
CREATE TABLE IF NOT EXISTS public.ucat_skill_trainer_question_stem_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_id UUID NOT NULL REFERENCES public.ucat_skill_trainers(id) ON DELETE CASCADE,
  question_stem_category_id UUID NOT NULL REFERENCES public.question_stem_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  UNIQUE (skill_trainer_id, question_stem_category_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_trainer_study_categories_trainer
  ON public.ucat_skill_trainer_question_stem_categories (skill_trainer_id);
CREATE INDEX IF NOT EXISTS idx_skill_trainer_study_categories_category
  ON public.ucat_skill_trainer_question_stem_categories (question_stem_category_id);
ALTER TABLE public.ucat_skill_trainer_question_stem_categories ENABLE ROW LEVEL SECURITY;
INSERT INTO public.ucat_skill_trainer_question_stem_categories (
  skill_trainer_id, question_stem_category_id
)
SELECT trainer.id, category.id
FROM public.ucat_skill_trainers trainer
JOIN public.question_stem_categories category
  ON (
    trainer.key IN ('find_word', 'find_concept')
    AND category.name IN ('Reading Comprehension', 'True, False, Can''t Tell')
  ) OR (
    trainer.key = 'quick_syllogism'
    AND category.name = 'Syllogisms'
  ) OR (
    trainer.key IN ('mental_maths', 'numpad_speed', 'calculator_maths')
    AND category.ucat_section_id = trainer.ucat_section_id
  )
WHERE category.ucat_section_id = trainer.ucat_section_id
ON CONFLICT (skill_trainer_id, question_stem_category_id) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_ucat_study_plan_tasks_category
  ON public.ucat_student_study_plan_tasks (question_stem_category_id)
  WHERE question_stem_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ucat_study_plan_tasks_skill_trainer
  ON public.ucat_student_study_plan_tasks (skill_trainer_id)
  WHERE skill_trainer_id IS NOT NULL;
