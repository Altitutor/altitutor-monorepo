ALTER TABLE public.ucat_student_study_plan_profiles
  ADD COLUMN IF NOT EXISTS study_suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.ucat_student_study_plan_profiles.study_suggestions_enabled IS
  'Controls the floating study-suggestion companion. Dashboard guidance remains available.';
