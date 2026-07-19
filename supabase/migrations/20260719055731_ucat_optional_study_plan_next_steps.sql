-- Make the dated Study plan optional while preserving the preparation goal,
-- and persist the stable pair of rolling next steps used without a plan.

ALTER TABLE public.ucat_student_study_plan_profiles
  ADD COLUMN study_plan_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.ucat_student_study_plan_profiles.study_plan_enabled IS
  'Whether Altitutor currently owns the student''s dated Study plan. Goal inputs remain active when false.';

CREATE TABLE public.ucat_student_next_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position IN (1, 2)),
  trigger_key TEXT NOT NULL,
  generated_on DATE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'learn',
    'skill_trainer',
    'practice',
    'section_benchmark',
    'mock',
    'review'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
  section_id UUID REFERENCES public.ucat_sections(id) ON DELETE SET NULL,
  question_stem_category_id UUID
    REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  learning_module_id UUID
    REFERENCES public.ucat_learning_modules(id) ON DELETE SET NULL,
  question_set_id UUID REFERENCES public.question_sets(id) ON DELETE SET NULL,
  mock_id UUID REFERENCES public.ucat_mocks(id) ON DELETE SET NULL,
  skill_trainer_id UUID
    REFERENCES public.ucat_skill_trainers(id) ON DELETE SET NULL,
  source_attempt_type TEXT CHECK (source_attempt_type IS NULL OR source_attempt_type IN (
    'practice_session',
    'set_attempt',
    'mock_attempt'
  )),
  source_attempt_id UUID,
  launch_path TEXT NOT NULL,
  launch_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, position)
);

CREATE INDEX idx_ucat_student_next_steps_student
  ON public.ucat_student_next_steps (student_id, position);

CREATE TRIGGER update_ucat_student_next_steps_updated_at
  BEFORE UPDATE ON public.ucat_student_next_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ucat_student_next_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own UCAT next steps"
  ON public.ucat_student_next_steps
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

-- Explicit exposure is required for projects created after Supabase's April
-- 2026 Data API default change. Mutations remain server-only.
GRANT SELECT ON public.ucat_student_next_steps TO authenticated;

COMMENT ON TABLE public.ucat_student_next_steps IS
  'The stable primary and secondary next steps for a student without a dated Study plan; this is not a hidden calendar.';
