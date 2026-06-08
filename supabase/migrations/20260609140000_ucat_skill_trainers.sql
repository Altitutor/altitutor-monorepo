-- UCAT Skill Trainers: catalog, config, item bank, student attempts
-- See CONTEXT.md (Skill trainer domain glossary)

-- ========================
-- 1) Catalog
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_skill_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  ucat_section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_skill_trainers_key_check CHECK (
    key IN (
      'find_word',
      'find_concept',
      'quick_syllogism',
      'mental_maths',
      'numpad_speed',
      'calculator_maths'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainers_section ON public.ucat_skill_trainers(ucat_section_id);
CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainers_enabled ON public.ucat_skill_trainers(is_enabled) WHERE is_enabled = true;

-- ========================
-- 2) Per-trainer config (admin)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_skill_trainer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_id UUID NOT NULL UNIQUE REFERENCES public.ucat_skill_trainers(id) ON DELETE CASCADE,
  time_limit_seconds INTEGER NOT NULL DEFAULT 60 CHECK (time_limit_seconds > 0),
  wrong_cooldown_seconds INTEGER NOT NULL DEFAULT 2 CHECK (wrong_cooldown_seconds >= 0),
  points_correct NUMERIC NOT NULL DEFAULT 10,
  points_wrong NUMERIC NOT NULL DEFAULT 5,
  streak_enabled BOOLEAN NOT NULL DEFAULT false,
  streak_multiplier_steps JSONB NOT NULL DEFAULT '[{"min_streak": 3, "multiplier": 1.5}, {"min_streak": 5, "multiplier": 2}]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- 3) Item bank (tutor-authored)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_skill_trainer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_id UUID NOT NULL REFERENCES public.ucat_skill_trainers(id) ON DELETE CASCADE,
  source_question_stem_id UUID REFERENCES public.question_stems(id) ON DELETE SET NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('approved', 'pending', 'rejected')),
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainer_items_trainer ON public.ucat_skill_trainer_items(skill_trainer_id);
CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainer_items_approval ON public.ucat_skill_trainer_items(approval_status);
CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainer_items_active ON public.ucat_skill_trainer_items(skill_trainer_id)
  WHERE deleted_at IS NULL AND is_active = true AND approval_status = 'approved';

-- ========================
-- 4) Student attempts
-- ========================
CREATE TABLE IF NOT EXISTS public.student_skill_trainer_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  skill_trainer_id UUID NOT NULL REFERENCES public.ucat_skill_trainers(id) ON DELETE RESTRICT,
  score NUMERIC NOT NULL DEFAULT 0,
  streak_count INTEGER NOT NULL DEFAULT 0,
  item_queue_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_item_index INTEGER NOT NULL DEFAULT 0,
  progress JSONB,
  config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ends_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_skill_trainer_attempts_student ON public.student_skill_trainer_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_trainer_attempts_trainer ON public.student_skill_trainer_attempts(skill_trainer_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_trainer_attempts_completed ON public.student_skill_trainer_attempts(student_id, skill_trainer_id, completed_at)
  WHERE completed_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_skill_trainer_attempts_one_in_progress
  ON public.student_skill_trainer_attempts(student_id)
  WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.student_skill_trainer_attempt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_attempt_id UUID NOT NULL REFERENCES public.student_skill_trainer_attempts(id) ON DELETE CASCADE,
  skill_trainer_item_id UUID NOT NULL REFERENCES public.ucat_skill_trainer_items(id) ON DELETE RESTRICT,
  score_delta NUMERIC NOT NULL DEFAULT 0,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_skill_trainer_attempt_items_attempt
  ON public.student_skill_trainer_attempt_items(skill_trainer_attempt_id);

-- ========================
-- 5) Seed six trainer types + default config
-- ========================
INSERT INTO public.ucat_skill_trainers (id, key, name, description, ucat_section_id, sort_order)
VALUES
  (
    'a1000001-0000-4000-8000-000000000001',
    'find_word',
    'Find the word',
    'Drag keywords to where they appear in the passage.',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    1
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    'find_concept',
    'Find the concept',
    'Click every occurrence of the concept in the passage.',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    2
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    'quick_syllogism',
    'Quick syllogisms',
    'Answer yes or no to one-sentence syllogism statements.',
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
    3
  ),
  (
    'a1000001-0000-4000-8000-000000000004',
    'mental_maths',
    'Mental maths',
    'Solve integer maths questions under time pressure.',
    '71269ce7-2364-454f-b056-7de66399ce77',
    4
  ),
  (
    'a1000001-0000-4000-8000-000000000005',
    'numpad_speed',
    'Numpad speed',
    'Enter calculator button sequences as fast as you can.',
    '71269ce7-2364-454f-b056-7de66399ce77',
    5
  ),
  (
    'a1000001-0000-4000-8000-000000000006',
    'calculator_maths',
    'Calculator maths speed',
    'Solve numeric QR-style questions using the UCAT calculator.',
    '71269ce7-2364-454f-b056-7de66399ce77',
    6
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ucat_skill_trainer_config (
  skill_trainer_id,
  time_limit_seconds,
  wrong_cooldown_seconds,
  points_correct,
  points_wrong,
  streak_enabled
)
SELECT
  t.id,
  60,
  CASE
    WHEN t.key = 'quick_syllogism' THEN 5
    WHEN t.key = 'numpad_speed' THEN 5
    ELSE 2
  END,
  10,
  CASE
    WHEN t.key = 'calculator_maths' THEN 3
    WHEN t.key IN ('find_word', 'find_concept') THEN 0
    ELSE 5
  END,
  t.key IN ('quick_syllogism', 'numpad_speed', 'calculator_maths')
FROM public.ucat_skill_trainers t
ON CONFLICT (skill_trainer_id) DO NOTHING;

-- ========================
-- 6) RLS
-- ========================
ALTER TABLE public.ucat_skill_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_skill_trainer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_skill_trainer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skill_trainer_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skill_trainer_attempt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainers" ON public.ucat_skill_trainers;
CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainers" ON public.ucat_skill_trainers
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainer_config" ON public.ucat_skill_trainer_config;
CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainer_config" ON public.ucat_skill_trainer_config
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainer_items" ON public.ucat_skill_trainer_items;
CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainer_items" ON public.ucat_skill_trainer_items
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_skill_trainer_attempts" ON public.student_skill_trainer_attempts;
CREATE POLICY "ADMINSTAFF full access to student_skill_trainer_attempts" ON public.student_skill_trainer_attempts
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_skill_trainer_attempt_items" ON public.student_skill_trainer_attempt_items;
CREATE POLICY "ADMINSTAFF full access to student_skill_trainer_attempt_items" ON public.student_skill_trainer_attempt_items
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- 7) Tutor views
-- ========================
CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainers
WITH (security_invoker = false)
AS
SELECT
  t.*,
  s.name AS section_name,
  s.section_number,
  c.time_limit_seconds,
  c.wrong_cooldown_seconds,
  c.points_correct,
  c.points_wrong,
  c.streak_enabled,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_skill_trainer_items i
    WHERE i.skill_trainer_id = t.id
      AND i.deleted_at IS NULL
  ) AS item_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_skill_trainer_items i
    WHERE i.skill_trainer_id = t.id
      AND i.deleted_at IS NULL
      AND i.approval_status = 'approved'
      AND i.is_active = true
  ) AS approved_active_item_count
FROM public.ucat_skill_trainers t
JOIN public.ucat_sections s ON s.id = t.ucat_section_id
LEFT JOIN public.ucat_skill_trainer_config c ON c.skill_trainer_id = t.id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_skill_trainers TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainer_items
WITH (security_invoker = false)
AS
SELECT
  i.*,
  t.key AS trainer_key,
  t.name AS trainer_name,
  approved_staff.first_name AS approved_by_first_name,
  approved_staff.last_name AS approved_by_last_name,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name
FROM public.ucat_skill_trainer_items i
JOIN public.ucat_skill_trainers t ON t.id = i.skill_trainer_id
LEFT JOIN public.staff approved_staff ON approved_staff.id = i.approved_by
LEFT JOIN public.staff created_staff ON created_staff.id = i.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_skill_trainer_items TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainer_config
WITH (security_invoker = false)
AS
SELECT c.*
FROM public.ucat_skill_trainer_config c
WHERE public.is_ucat_tutor() OR (SELECT public.is_adminstaff_active());

GRANT SELECT ON public.vtutor_ucat_skill_trainer_config TO authenticated;

-- ========================
-- 8) Student views
-- ========================
CREATE OR REPLACE VIEW public.vstudent_ucat_skill_trainers
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.key,
  t.name,
  t.description,
  t.ucat_section_id,
  t.sort_order,
  s.name AS section_name,
  s.section_number,
  c.time_limit_seconds,
  c.wrong_cooldown_seconds,
  c.streak_enabled
FROM public.ucat_skill_trainers t
JOIN public.ucat_sections s ON s.id = t.ucat_section_id
JOIN public.ucat_skill_trainer_config c ON c.skill_trainer_id = t.id
WHERE public.is_ucat_online_student()
  AND t.is_enabled = true;

GRANT SELECT ON public.vstudent_ucat_skill_trainers TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_skill_trainer_attempts
WITH (security_invoker = false)
AS
SELECT
  a.*,
  t.key AS trainer_key,
  t.name AS trainer_name
FROM public.student_skill_trainer_attempts a
JOIN public.ucat_skill_trainers t ON t.id = a.skill_trainer_id
WHERE a.student_id = (SELECT public.current_student_id())
  AND public.is_ucat_online_student();

GRANT SELECT ON public.vstudent_ucat_my_skill_trainer_attempts TO authenticated;

-- ========================
-- 9) Tutor RPCs
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_skill_trainer_item(
  p_item_id UUID,
  p_skill_trainer_id UUID,
  p_content JSONB,
  p_source_question_stem_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_item_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_item_id IS NULL THEN
    INSERT INTO public.ucat_skill_trainer_items (
      skill_trainer_id,
      content,
      source_question_stem_id,
      is_active,
      approval_status,
      created_by,
      updated_by
    )
    VALUES (
      p_skill_trainer_id,
      COALESCE(p_content, '{}'::jsonb),
      p_source_question_stem_id,
      COALESCE(p_is_active, true),
      'pending',
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_item_id;
  ELSE
    UPDATE public.ucat_skill_trainer_items
    SET
      skill_trainer_id = p_skill_trainer_id,
      content = COALESCE(p_content, '{}'::jsonb),
      source_question_stem_id = p_source_question_stem_id,
      is_active = COALESCE(p_is_active, is_active),
      approval_status = 'pending',
      approved_by = NULL,
      approved_at = NULL,
      updated_by = v_staff_id,
      updated_at = NOW()
    WHERE id = p_item_id
      AND deleted_at IS NULL
    RETURNING id INTO v_item_id;

    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'skill_trainer_item_not_found';
    END IF;
  END IF;

  RETURN v_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_skill_trainer_item(UUID, UUID, JSONB, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_skill_trainer_item_approval(
  p_item_id UUID,
  p_approval_status TEXT
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

  IF p_approval_status NOT IN ('approved', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'invalid_approval_status';
  END IF;

  v_staff_id := public.current_tutor_id();

  UPDATE public.ucat_skill_trainer_items
  SET approval_status = p_approval_status,
      approved_by = CASE WHEN p_approval_status = 'approved' THEN v_staff_id ELSE NULL END,
      approved_at = CASE WHEN p_approval_status = 'approved' THEN NOW() ELSE NULL END,
      updated_by = v_staff_id,
      updated_at = NOW()
  WHERE id = p_item_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_trainer_item_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_skill_trainer_item_approval(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_soft_delete_skill_trainer_item(p_item_id UUID)
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

  v_staff_id := public.current_tutor_id();

  UPDATE public.ucat_skill_trainer_items
  SET deleted_at = NOW(),
      deleted_by = v_staff_id,
      updated_by = v_staff_id,
      updated_at = NOW()
  WHERE id = p_item_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_trainer_item_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_soft_delete_skill_trainer_item(UUID) TO authenticated;
