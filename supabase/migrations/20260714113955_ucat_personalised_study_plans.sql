-- Personalised UCAT study plans.
--
-- Score projection remains an independent evidence/trajectory surface. Study
-- plans consume a projection snapshot and persist their own profile,
-- generations, and tasks so future recalculation does not rewrite history.

DO $$ BEGIN
  CREATE TYPE public.ucat_learning_module_study_plan_priority AS ENUM (
    'essential',
    'recommended',
    'optional',
    'excluded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.ucat_learning_modules
  ADD COLUMN IF NOT EXISTS study_plan_priority
    public.ucat_learning_module_study_plan_priority NOT NULL DEFAULT 'recommended';

COMMENT ON COLUMN public.ucat_learning_modules.study_plan_priority IS
  'Tutor-managed Study plan priority. Excluded lessons are never prescribed.';

CREATE TABLE IF NOT EXISTS public.ucat_learning_module_question_stem_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_module_id UUID NOT NULL
    REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE,
  question_stem_category_id UUID NOT NULL
    REFERENCES public.question_stem_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  UNIQUE (learning_module_id, question_stem_category_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_module_study_categories_module
  ON public.ucat_learning_module_question_stem_categories (learning_module_id);
CREATE INDEX IF NOT EXISTS idx_learning_module_study_categories_category
  ON public.ucat_learning_module_question_stem_categories (question_stem_category_id);

CREATE TABLE IF NOT EXISTS public.ucat_learning_module_question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_module_id UUID NOT NULL
    REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE,
  question_tag_id UUID NOT NULL
    REFERENCES public.question_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  UNIQUE (learning_module_id, question_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_module_study_tags_module
  ON public.ucat_learning_module_question_tags (learning_module_id);
CREATE INDEX IF NOT EXISTS idx_learning_module_study_tags_tag
  ON public.ucat_learning_module_question_tags (question_tag_id);

CREATE TABLE IF NOT EXISTS public.ucat_study_plan_test_windows (
  test_year INTEGER PRIMARY KEY CHECK (test_year BETWEEN 2020 AND 2100),
  bookings_open_on DATE,
  testing_starts_on DATE NOT NULL,
  testing_ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_study_plan_test_window_dates CHECK (
    testing_ends_on >= testing_starts_on
    AND (bookings_open_on IS NULL OR bookings_open_on <= testing_ends_on)
  )
);

COMMENT ON TABLE public.ucat_study_plan_test_windows IS
  'Admin-configured UCAT ANZ booking and testing windows used for year-only Study plan profiles.';

INSERT INTO public.ucat_study_plan_test_windows (
  test_year,
  bookings_open_on,
  testing_starts_on,
  testing_ends_on
)
VALUES (2026, '2026-03-03', '2026-07-01', '2026-08-05')
ON CONFLICT (test_year) DO NOTHING;

CREATE TRIGGER update_ucat_study_plan_test_windows_updated_at
  BEFORE UPDATE ON public.ucat_study_plan_test_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.ucat_student_study_plan_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  target_score INTEGER NOT NULL CHECK (target_score BETWEEN 900 AND 2700),
  test_year INTEGER NOT NULL CHECK (test_year BETWEEN 2020 AND 2100),
  test_date DATE,
  available_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_mock_weekday SMALLINT NOT NULL CHECK (preferred_mock_weekday BETWEEN 0 AND 6),
  setup_completed_at TIMESTAMPTZ,
  last_generated_at TIMESTAMPTZ,
  next_weekly_replan_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_student_study_plan_test_date_year CHECK (
    test_date IS NULL OR EXTRACT(YEAR FROM test_date)::INTEGER = test_year
  ),
  CONSTRAINT ucat_student_study_plan_available_days_array CHECK (
    jsonb_typeof(available_days) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_ucat_student_study_plan_profiles_student
  ON public.ucat_student_study_plan_profiles (student_id);

COMMENT ON TABLE public.ucat_student_study_plan_profiles IS
  'Student planning inputs. Available-day durations are ceilings, not required workloads.';

CREATE TRIGGER update_ucat_student_study_plan_profiles_updated_at
  BEFORE UPDATE ON public.ucat_student_study_plan_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.ucat_student_study_plan_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.ucat_student_study_plan_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'onboarding',
    'weekly',
    'profile_changed',
    'mock_completed',
    'significant_activity',
    'manual'
  )),
  planning_date DATE NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  projection_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  capacity_risk JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  CONSTRAINT ucat_student_study_plan_generation_dates CHECK (ends_on >= starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_student_study_plan_one_active_generation
  ON public.ucat_student_study_plan_generations (student_id)
  WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ucat_student_study_plan_generations_student_history
  ON public.ucat_student_study_plan_generations (student_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.ucat_student_study_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL
    REFERENCES public.ucat_student_study_plan_generations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  task_type TEXT NOT NULL CHECK (task_type IN (
    'learn',
    'skill_trainer',
    'practice',
    'section_benchmark',
    'mock',
    'review'
  )),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'in_progress',
    'partial',
    'completed',
    'skipped'
  )),
  title TEXT NOT NULL,
  description TEXT,
  rationale TEXT,
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
  target_units INTEGER CHECK (target_units IS NULL OR target_units > 0),
  completed_units INTEGER NOT NULL DEFAULT 0 CHECK (completed_units >= 0),
  section_id UUID REFERENCES public.ucat_sections(id) ON DELETE SET NULL,
  question_stem_category_id UUID
    REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  question_tag_id UUID REFERENCES public.question_tags(id) ON DELETE SET NULL,
  learning_module_id UUID REFERENCES public.ucat_learning_modules(id) ON DELETE SET NULL,
  question_set_id UUID REFERENCES public.question_sets(id) ON DELETE SET NULL,
  mock_id UUID REFERENCES public.ucat_mocks(id) ON DELETE SET NULL,
  skill_trainer_id UUID REFERENCES public.ucat_skill_trainers(id) ON DELETE SET NULL,
  launch_path TEXT,
  launch_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  matched_activity_type TEXT,
  matched_activity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (generation_id, scheduled_date, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_ucat_student_study_plan_tasks_active_calendar
  ON public.ucat_student_study_plan_tasks (student_id, scheduled_date, sort_order);
CREATE INDEX IF NOT EXISTS idx_ucat_student_study_plan_tasks_generation
  ON public.ucat_student_study_plan_tasks (generation_id);
CREATE INDEX IF NOT EXISTS idx_ucat_student_study_plan_tasks_learning_module
  ON public.ucat_student_study_plan_tasks (learning_module_id)
  WHERE learning_module_id IS NOT NULL;

CREATE TRIGGER update_ucat_student_study_plan_tasks_updated_at
  BEFORE UPDATE ON public.ucat_student_study_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Signup now includes Study plan setup before the plan-choice step.
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_ucat_signup_step_check;

-- The previous five-step flow persisted completed students at step 5. In the
-- new four-step flow, plan choice is the terminal step, so normalise legacy
-- completed/out-of-range progress before tightening the constraint.
UPDATE public.students
SET ucat_signup_step = 4
WHERE ucat_signup_completed_at IS NOT NULL
   OR ucat_signup_step > 4;

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_signup_step_check
  CHECK (ucat_signup_step BETWEEN 1 AND 4);
COMMENT ON COLUMN public.students.ucat_signup_step IS
  'Current signup onboarding step (1=details, 2=password, 3=Study plan, 4=plan choice).';

-- Append planning metadata to the existing student/tutor module views without
-- changing the meaning or order of their existing columns.
CREATE OR REPLACE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.is_private,
  lm.created_at,
  lm.updated_at,
  lm.created_by,
  lm.updated_by,
  lm.deleted_at,
  lm.deleted_by,
  s.name AS section_name,
  s.section_number,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_modules child
    WHERE child.parent_ucat_learning_module_id = lm.id
      AND child.deleted_at IS NULL
  ) AS child_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_module_blocks block
    WHERE block.learning_module_id = lm.id
      AND block.deleted_at IS NULL
  ) AS block_count,
  lm.study_plan_priority
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_learning_modules TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.is_private,
  s.name AS section_name,
  s.section_number,
  progress.started_at,
  progress.completion_percent,
  progress.completed_at,
  lm.study_plan_priority
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context context
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress progress
  ON progress.learning_module_id = lm.id
  AND progress.student_id = context.student_id
LEFT JOIN public.vstudent_ucat_accessible_learning_modules accessible_module
  ON accessible_module.id = lm.id
WHERE lm.deleted_at IS NULL
  AND context.has_online_access
  AND (
    lm.kind = 'folder'
    OR accessible_module.id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      JOIN public.vstudent_ucat_accessible_learning_modules accessible_child
        ON accessible_child.id = child.id
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
    )
  );

GRANT SELECT ON public.vstudent_ucat_learning_modules TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_update_learning_module_study_plan_metadata(
  p_learning_module_id UUID,
  p_priority TEXT,
  p_category_ids UUID[] DEFAULT '{}'::UUID[],
  p_tag_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_priority NOT IN ('essential', 'recommended', 'optional', 'excluded') THEN
    RAISE EXCEPTION 'invalid Study plan priority';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_learning_modules
    WHERE id = p_learning_module_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'learning module not found';
  END IF;

  v_staff_id := public.current_tutor_id();
  UPDATE public.ucat_learning_modules
  SET
    study_plan_priority = p_priority::public.ucat_learning_module_study_plan_priority,
    updated_by = v_staff_id,
    updated_at = NOW()
  WHERE id = p_learning_module_id;

  DELETE FROM public.ucat_learning_module_question_stem_categories
  WHERE learning_module_id = p_learning_module_id;
  INSERT INTO public.ucat_learning_module_question_stem_categories (
    learning_module_id,
    question_stem_category_id,
    created_by
  )
  SELECT p_learning_module_id, category_id, v_staff_id
  FROM unnest(COALESCE(p_category_ids, '{}'::UUID[])) category_id
  WHERE EXISTS (
    SELECT 1 FROM public.question_stem_categories category
    WHERE category.id = category_id
  )
  ON CONFLICT DO NOTHING;

  DELETE FROM public.ucat_learning_module_question_tags
  WHERE learning_module_id = p_learning_module_id;
  INSERT INTO public.ucat_learning_module_question_tags (
    learning_module_id,
    question_tag_id,
    created_by
  )
  SELECT p_learning_module_id, tag_id, v_staff_id
  FROM unnest(COALESCE(p_tag_ids, '{}'::UUID[])) tag_id
  WHERE EXISTS (
    SELECT 1 FROM public.question_tags tag
    WHERE tag.id = tag_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_update_learning_module_study_plan_metadata(
  UUID,
  TEXT,
  UUID[],
  UUID[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_update_learning_module_study_plan_metadata(
  UUID,
  TEXT,
  UUID[],
  UUID[]
) TO authenticated;

ALTER TABLE public.ucat_learning_module_question_stem_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_learning_module_question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_study_plan_test_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_student_study_plan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_student_study_plan_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_student_study_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage learning module study categories"
  ON public.ucat_learning_module_question_stem_categories
  FOR ALL TO authenticated
  USING ((SELECT public.is_ucat_tutor()))
  WITH CHECK ((SELECT public.is_ucat_tutor()));
CREATE POLICY "Tutors manage learning module study tags"
  ON public.ucat_learning_module_question_tags
  FOR ALL TO authenticated
  USING ((SELECT public.is_ucat_tutor()))
  WITH CHECK ((SELECT public.is_ucat_tutor()));

CREATE POLICY "Authenticated read UCAT Study plan test windows"
  ON public.ucat_study_plan_test_windows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin staff manage UCAT Study plan test windows"
  ON public.ucat_study_plan_test_windows
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "Students read own Study plan profile"
  ON public.ucat_student_study_plan_profiles
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));
CREATE POLICY "Students read own Study plan generations"
  ON public.ucat_student_study_plan_generations
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));
CREATE POLICY "Students read own Study plan tasks"
  ON public.ucat_student_study_plan_tasks
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ucat_learning_module_question_stem_categories,
     public.ucat_learning_module_question_tags
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ucat_study_plan_test_windows
  TO authenticated;
GRANT SELECT
  ON public.ucat_student_study_plan_profiles,
     public.ucat_student_study_plan_generations,
     public.ucat_student_study_plan_tasks
  TO authenticated;
