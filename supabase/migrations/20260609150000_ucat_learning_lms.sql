-- UCAT Learning LMS: modules, blocks, progress, skill trainer sets, session links
-- See CONTEXT.md (Learning module domain glossary)

-- ========================
-- 1) Enums
-- ========================
DO $$ BEGIN
  CREATE TYPE public.ucat_learning_module_kind AS ENUM ('folder', 'lesson');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ucat_learning_module_display_mode AS ENUM ('scroll', 'stepped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ucat_learning_module_block_type AS ENUM (
    'text',
    'video',
    'file',
    'question_stem',
    'question',
    'skill_trainer_set'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 2) Skill trainer sets (before blocks FK)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_skill_trainer_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_id UUID NOT NULL REFERENCES public.ucat_skill_trainers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainer_sets_trainer
  ON public.ucat_skill_trainer_sets(skill_trainer_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ucat_skill_trainer_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_trainer_set_id UUID NOT NULL REFERENCES public.ucat_skill_trainer_sets(id) ON DELETE CASCADE,
  skill_trainer_item_id UUID NOT NULL REFERENCES public.ucat_skill_trainer_items(id) ON DELETE RESTRICT,
  index INTEGER NOT NULL CHECK (index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_trainer_set_id, skill_trainer_item_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_skill_trainer_set_items_set_index
  ON public.ucat_skill_trainer_set_items(skill_trainer_set_id, index);

CREATE INDEX IF NOT EXISTS idx_ucat_skill_trainer_set_items_item
  ON public.ucat_skill_trainer_set_items(skill_trainer_item_id);

CREATE OR REPLACE FUNCTION public.validate_skill_trainer_set_item_trainer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_set_trainer_id UUID;
  v_item_trainer_id UUID;
BEGIN
  SELECT skill_trainer_id INTO v_set_trainer_id
  FROM public.ucat_skill_trainer_sets
  WHERE id = NEW.skill_trainer_set_id AND deleted_at IS NULL;

  SELECT skill_trainer_id INTO v_item_trainer_id
  FROM public.ucat_skill_trainer_items
  WHERE id = NEW.skill_trainer_item_id AND deleted_at IS NULL;

  IF v_set_trainer_id IS NULL OR v_item_trainer_id IS NULL THEN
    RAISE EXCEPTION 'invalid_skill_trainer_set_item_reference';
  END IF;

  IF v_set_trainer_id <> v_item_trainer_id THEN
    RAISE EXCEPTION 'skill_trainer_set_item_trainer_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_skill_trainer_set_item_trainer_trigger ON public.ucat_skill_trainer_set_items;
CREATE TRIGGER validate_skill_trainer_set_item_trainer_trigger
  BEFORE INSERT OR UPDATE ON public.ucat_skill_trainer_set_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_skill_trainer_set_item_trainer();

-- ========================
-- 3) Learning modules
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_learning_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.ucat_learning_module_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ucat_section_id UUID REFERENCES public.ucat_sections(id) ON DELETE SET NULL,
  parent_ucat_learning_module_id UUID REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE,
  index INTEGER NOT NULL CHECK (index >= 0),
  is_private BOOLEAN NOT NULL DEFAULT true,
  display_mode public.ucat_learning_module_display_mode,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT ucat_learning_modules_kind_display_mode CHECK (
    (kind = 'folder' AND display_mode IS NULL)
    OR (kind = 'lesson' AND display_mode IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ucat_learning_modules_parent
  ON public.ucat_learning_modules(parent_ucat_learning_module_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ucat_learning_modules_section
  ON public.ucat_learning_modules(ucat_section_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_learning_modules_root_index
  ON public.ucat_learning_modules(index)
  WHERE parent_ucat_learning_module_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_learning_modules_parent_index
  ON public.ucat_learning_modules(parent_ucat_learning_module_id, index)
  WHERE parent_ucat_learning_module_id IS NOT NULL AND deleted_at IS NULL;

-- ========================
-- 4) Learning module blocks (lessons only; enforced in RPC)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_learning_module_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_module_id UUID NOT NULL REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE,
  block_type public.ucat_learning_module_block_type NOT NULL,
  index INTEGER NOT NULL CHECK (index >= 0),
  require_completion_before_next BOOLEAN NOT NULL DEFAULT true,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_stem_id UUID REFERENCES public.question_stems(id) ON DELETE RESTRICT,
  question_id UUID REFERENCES public.ucat_questions(id) ON DELETE RESTRICT,
  file_id UUID REFERENCES public.files(id) ON DELETE RESTRICT,
  skill_trainer_set_id UUID REFERENCES public.ucat_skill_trainer_sets(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ucat_learning_module_blocks_type_payload CHECK (
    (block_type = 'text')
    OR (block_type = 'video' AND (content ? 'url'))
    OR (block_type = 'file' AND file_id IS NOT NULL)
    OR (block_type = 'question_stem' AND question_stem_id IS NOT NULL)
    OR (block_type = 'question' AND question_id IS NOT NULL)
    OR (block_type = 'skill_trainer_set' AND skill_trainer_set_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_learning_module_blocks_module_index
  ON public.ucat_learning_module_blocks(learning_module_id, index)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ucat_learning_module_blocks_module
  ON public.ucat_learning_module_blocks(learning_module_id)
  WHERE deleted_at IS NULL;

-- ========================
-- 5) Student progress
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_student_learning_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  learning_module_id UUID NOT NULL REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_percent NUMERIC NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, learning_module_id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_student_learning_module_progress_student
  ON public.ucat_student_learning_module_progress(student_id);

CREATE TABLE IF NOT EXISTS public.ucat_student_learning_module_block_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  learning_module_block_id UUID NOT NULL REFERENCES public.ucat_learning_module_blocks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  manually_completed BOOLEAN NOT NULL DEFAULT false,
  interaction_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (student_id, learning_module_block_id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_student_learning_block_progress_student
  ON public.ucat_student_learning_module_block_progress(student_id);

-- ========================
-- 6) Session resources: learning module lessons
-- ========================
ALTER TABLE public.ucat_sessions_resources
  ADD COLUMN IF NOT EXISTS ucat_learning_module_id UUID REFERENCES public.ucat_learning_modules(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ucat_sessions_resources_learning_module
  ON public.ucat_sessions_resources(ucat_learning_module_id)
  WHERE ucat_learning_module_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_sessions_resources_session_learning_module_unique
  ON public.ucat_sessions_resources(session_id, ucat_learning_module_id)
  WHERE ucat_learning_module_id IS NOT NULL;

ALTER TABLE public.ucat_sessions_resources
  DROP CONSTRAINT IF EXISTS ucat_sessions_resources_one_resource;

ALTER TABLE public.ucat_sessions_resources
  ADD CONSTRAINT ucat_sessions_resources_one_resource CHECK (
    (
      CASE WHEN ucat_mock_id IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN question_set_id IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN question_stem_id IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN ucat_learning_module_id IS NOT NULL THEN 1 ELSE 0 END
    ) = 1
  );

-- ========================
-- 7) Learn-context skill trainer + question attempts
-- ========================
ALTER TABLE public.student_skill_trainer_attempts
  ADD COLUMN IF NOT EXISTS learning_module_block_id UUID REFERENCES public.ucat_learning_module_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_trainer_set_id UUID REFERENCES public.ucat_skill_trainer_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_skill_trainer_attempts_learn_block
  ON public.student_skill_trainer_attempts(learning_module_block_id)
  WHERE learning_module_block_id IS NOT NULL;

ALTER TABLE public.student_question_attempts
  ADD COLUMN IF NOT EXISTS learning_module_block_id UUID REFERENCES public.ucat_learning_module_blocks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_question_attempts_learn_block
  ON public.student_question_attempts(learning_module_block_id)
  WHERE learning_module_block_id IS NOT NULL;

ALTER TABLE public.student_question_attempts
  DROP CONSTRAINT IF EXISTS student_question_attempts_mode_check;

ALTER TABLE public.student_question_attempts
  ADD CONSTRAINT student_question_attempts_mode_check
  CHECK (mode IS NULL OR mode IN ('question', 'question_stem', 'set', 'mock', 'learn'));

-- ========================
-- 8) Access helpers
-- ========================
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_learning_module(p_learning_module_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules lm
      WHERE lm.id = p_learning_module_id
        AND lm.deleted_at IS NULL
        AND lm.kind = 'lesson'
    )
    AND (
      (
        public.is_ucat_online_student()
        AND EXISTS (
          SELECT 1
          FROM public.ucat_learning_modules lm
          WHERE lm.id = p_learning_module_id
            AND lm.is_private = false
            AND lm.deleted_at IS NULL
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.ucat_sessions_resources usr
        JOIN public.sessions sess ON sess.id = usr.session_id
        JOIN public.classes c ON c.id = sess.class_id
        JOIN public.classes_students cs ON cs.class_id = c.id AND cs.student_id = public.current_student_id()
        WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
          AND cs.unenrolled_at IS NULL
          AND usr.ucat_learning_module_id = p_learning_module_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_learning_module(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_skill_trainer_set(p_skill_trainer_set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.ucat_skill_trainer_sets sts
      WHERE sts.id = p_skill_trainer_set_id
        AND sts.deleted_at IS NULL
    )
    AND (
      (
        public.is_ucat_tutor()
        OR (SELECT public.is_adminstaff_active())
      )
      OR EXISTS (
        SELECT 1
        FROM public.ucat_learning_module_blocks b
        JOIN public.ucat_learning_modules lm ON lm.id = b.learning_module_id
        WHERE b.skill_trainer_set_id = p_skill_trainer_set_id
          AND b.deleted_at IS NULL
          AND lm.deleted_at IS NULL
          AND public.can_student_access_ucat_learning_module(lm.id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_skill_trainer_set(UUID) TO authenticated;

-- ========================
-- 9) RLS
-- ========================
ALTER TABLE public.ucat_skill_trainer_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_skill_trainer_set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_learning_module_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_student_learning_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_student_learning_module_block_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainer_sets" ON public.ucat_skill_trainer_sets;
CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainer_sets" ON public.ucat_skill_trainer_sets
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_skill_trainer_set_items" ON public.ucat_skill_trainer_set_items;
CREATE POLICY "ADMINSTAFF full access to ucat_skill_trainer_set_items" ON public.ucat_skill_trainer_set_items
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_learning_modules" ON public.ucat_learning_modules;
CREATE POLICY "ADMINSTAFF full access to ucat_learning_modules" ON public.ucat_learning_modules
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_learning_module_blocks" ON public.ucat_learning_module_blocks;
CREATE POLICY "ADMINSTAFF full access to ucat_learning_module_blocks" ON public.ucat_learning_module_blocks
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_student_learning_module_progress" ON public.ucat_student_learning_module_progress;
CREATE POLICY "ADMINSTAFF full access to ucat_student_learning_module_progress" ON public.ucat_student_learning_module_progress
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_student_learning_module_block_progress" ON public.ucat_student_learning_module_block_progress;
CREATE POLICY "ADMINSTAFF full access to ucat_student_learning_module_block_progress" ON public.ucat_student_learning_module_block_progress
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- 10) Tutor views
-- ========================
CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainer_sets
WITH (security_invoker = false)
AS
SELECT
  s.*,
  t.key AS trainer_key,
  t.name AS trainer_name,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_skill_trainer_set_items si
    WHERE si.skill_trainer_set_id = s.id
  ) AS item_count
FROM public.ucat_skill_trainer_sets s
JOIN public.ucat_skill_trainers t ON t.id = s.skill_trainer_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_skill_trainer_sets TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainer_set_items
WITH (security_invoker = false)
AS
SELECT
  si.*,
  i.content AS item_content,
  i.approval_status,
  i.is_active AS item_is_active
FROM public.ucat_skill_trainer_set_items si
JOIN public.ucat_skill_trainer_items i ON i.id = si.skill_trainer_item_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_skill_trainer_set_items TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.*,
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
    FROM public.ucat_learning_module_blocks b
    WHERE b.learning_module_id = lm.id
      AND b.deleted_at IS NULL
  ) AS block_count
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_learning_modules TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_module_blocks
WITH (security_invoker = false)
AS
SELECT b.*
FROM public.ucat_learning_module_blocks b
JOIN public.ucat_learning_modules lm ON lm.id = b.learning_module_id
WHERE public.is_ucat_tutor()
  AND b.deleted_at IS NULL
  AND lm.deleted_at IS NULL;

GRANT SELECT ON public.vtutor_ucat_learning_module_blocks TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_sessions_resources;
CREATE VIEW public.vtutor_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.question_stem_id,
  usr.ucat_learning_module_id,
  usr.index,
  usr.created_by,
  usr.created_at
FROM public.ucat_sessions_resources usr
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_sessions_resources TO authenticated;

-- ========================
-- 11) Student views
-- ========================
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
  lm.display_mode,
  s.name AS section_name,
  s.section_number,
  p.started_at,
  p.completion_percent,
  p.completed_at
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress p
  ON p.learning_module_id = lm.id
  AND p.student_id = (SELECT public.current_student_id())
WHERE lm.deleted_at IS NULL
  AND public.is_ucat_online_student()
  AND (
    lm.kind = 'folder'
    OR public.can_student_access_ucat_learning_module(lm.id)
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
        AND public.can_student_access_ucat_learning_module(child.id)
    )
  );

GRANT SELECT ON public.vstudent_ucat_learning_modules TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_learning_module_blocks
WITH (security_invoker = false)
AS
SELECT
  b.id,
  b.learning_module_id,
  b.block_type,
  b.index,
  b.require_completion_before_next,
  b.content,
  b.question_stem_id,
  b.question_id,
  b.file_id,
  b.skill_trainer_set_id,
  bp.completed_at AS block_completed_at,
  bp.manually_completed,
  bp.interaction_state
FROM public.ucat_learning_module_blocks b
JOIN public.ucat_learning_modules lm ON lm.id = b.learning_module_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT public.current_student_id())
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND public.can_student_access_ucat_learning_module(lm.id);

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_sessions_resources;
CREATE VIEW public.vstudent_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.question_stem_id,
  usr.ucat_learning_module_id,
  usr.index,
  usr.created_by,
  usr.created_at
FROM public.ucat_sessions_resources usr
JOIN public.sessions s ON s.id = usr.session_id
JOIN public.classes c ON c.id = s.class_id
JOIN public.classes_students cs ON cs.class_id = c.id
WHERE public.is_ucat_student()
  AND cs.student_id = public.current_student_id()
  AND cs.unenrolled_at IS NULL
  AND c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1);

GRANT SELECT ON public.vstudent_ucat_sessions_resources TO authenticated;

-- ========================
-- 12) Tutor RPCs: skill trainer sets
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_skill_trainer_set(
  p_set_id UUID,
  p_skill_trainer_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_is_private BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_set_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_set_id IS NULL THEN
    INSERT INTO public.ucat_skill_trainer_sets (
      skill_trainer_id, name, description, is_private, created_by, updated_by
    )
    VALUES (
      p_skill_trainer_id, p_name, p_description, COALESCE(p_is_private, true), v_staff_id, v_staff_id
    )
    RETURNING id INTO v_set_id;
  ELSE
    UPDATE public.ucat_skill_trainer_sets
    SET
      skill_trainer_id = p_skill_trainer_id,
      name = p_name,
      description = p_description,
      is_private = COALESCE(p_is_private, is_private),
      updated_by = v_staff_id,
      updated_at = NOW()
    WHERE id = p_set_id AND deleted_at IS NULL
    RETURNING id INTO v_set_id;

    IF v_set_id IS NULL THEN
      RAISE EXCEPTION 'skill_trainer_set_not_found';
    END IF;
  END IF;

  RETURN v_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_skill_trainer_set(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_skill_trainer_set_items(
  p_set_id UUID,
  p_item_ids JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_skill_trainer_sets WHERE id = p_set_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'skill_trainer_set_not_found';
  END IF;

  DELETE FROM public.ucat_skill_trainer_set_items WHERE skill_trainer_set_id = p_set_id;

  INSERT INTO public.ucat_skill_trainer_set_items (skill_trainer_set_id, skill_trainer_item_id, index)
  SELECT
    p_set_id,
    NULLIF(elem.value, '')::UUID,
    (elem.ordinality - 1)::INTEGER
  FROM jsonb_array_elements_text(COALESCE(p_item_ids, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
  WHERE NULLIF(elem.value, '')::UUID IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_replace_skill_trainer_set_items(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_soft_delete_skill_trainer_set(p_set_id UUID)
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

  UPDATE public.ucat_skill_trainer_sets
  SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id, updated_at = NOW()
  WHERE id = p_set_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_trainer_set_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_soft_delete_skill_trainer_set(UUID) TO authenticated;

-- ========================
-- 13) Tutor RPCs: learning modules
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_is_private BOOLEAN DEFAULT true,
  p_display_mode public.ucat_learning_module_display_mode DEFAULT 'stepped'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_module_id UUID;
  v_display_mode public.ucat_learning_module_display_mode;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_kind = 'folder' THEN
    v_display_mode := NULL;
  ELSE
    v_display_mode := COALESCE(p_display_mode, 'stepped'::public.ucat_learning_module_display_mode);
  END IF;

  IF p_module_id IS NULL THEN
    INSERT INTO public.ucat_learning_modules (
      kind, title, description, ucat_section_id, parent_ucat_learning_module_id,
      index, is_private, display_mode, created_by, updated_by
    )
    VALUES (
      p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
      COALESCE(p_index, 0), COALESCE(p_is_private, true), v_display_mode, v_staff_id, v_staff_id
    )
    RETURNING id INTO v_module_id;
  ELSE
    UPDATE public.ucat_learning_modules
    SET
      kind = p_kind,
      title = p_title,
      description = p_description,
      ucat_section_id = p_ucat_section_id,
      parent_ucat_learning_module_id = p_parent_id,
      index = COALESCE(p_index, index),
      is_private = COALESCE(p_is_private, is_private),
      display_mode = v_display_mode,
      updated_by = v_staff_id,
      updated_at = NOW()
    WHERE id = p_module_id AND deleted_at IS NULL
    RETURNING id INTO v_module_id;

    IF v_module_id IS NULL THEN
      RAISE EXCEPTION 'learning_module_not_found';
    END IF;
  END IF;

  RETURN v_module_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_learning_module(UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER, BOOLEAN, public.ucat_learning_module_display_mode) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_learning_module_blocks(
  p_module_id UUID,
  p_blocks JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.ucat_learning_module_kind;
  v_block JSONB;
  v_idx INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT kind INTO v_kind
  FROM public.ucat_learning_modules
  WHERE id = p_module_id AND deleted_at IS NULL;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  IF v_kind <> 'lesson' THEN
    RAISE EXCEPTION 'learning_module_not_lesson';
  END IF;

  UPDATE public.ucat_learning_module_blocks
  SET deleted_at = NOW()
  WHERE learning_module_id = p_module_id AND deleted_at IS NULL;

  IF jsonb_typeof(p_blocks) = 'array' THEN
    v_idx := 0;
    FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
    LOOP
      INSERT INTO public.ucat_learning_module_blocks (
        learning_module_id,
        block_type,
        index,
        require_completion_before_next,
        content,
        question_stem_id,
        question_id,
        file_id,
        skill_trainer_set_id
      )
      VALUES (
        p_module_id,
        (v_block->>'block_type')::public.ucat_learning_module_block_type,
        COALESCE((v_block->>'index')::INTEGER, v_idx),
        COALESCE((v_block->>'require_completion_before_next')::BOOLEAN, true),
        COALESCE(v_block->'content', '{}'::jsonb),
        NULLIF(v_block->>'question_stem_id', '')::UUID,
        NULLIF(v_block->>'question_id', '')::UUID,
        NULLIF(v_block->>'file_id', '')::UUID,
        NULLIF(v_block->>'skill_trainer_set_id', '')::UUID
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_replace_learning_module_blocks(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_soft_delete_learning_module(p_module_id UUID)
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

  UPDATE public.ucat_learning_modules
  SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id, updated_at = NOW()
  WHERE id = p_module_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_soft_delete_learning_module(UUID) TO authenticated;

-- ========================
-- 14) Session resources RPC: add lesson type
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_sessions_resources(p_assignments JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_ucat_subject_id UUID;
  v_assignments_elem JSONB;
  v_session_id UUID;
  v_resources JSONB;
  v_resource JSONB;
  v_idx INT;
  v_question_set_id UUID;
  v_ucat_mock_id UUID;
  v_question_stem_id UUID;
  v_learning_module_id UUID;
  v_allowed_sessions UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();
  SELECT id INTO v_ucat_subject_id FROM public.subjects WHERE name = 'UCAT' LIMIT 1;

  SELECT ARRAY_AGG(s.id)
  INTO v_allowed_sessions
  FROM public.sessions s
  JOIN public.classes c ON c.id = s.class_id
  JOIN public.classes_staff cs ON cs.class_id = c.id AND cs.unassigned_at IS NULL
  WHERE c.subject_id = v_ucat_subject_id
    AND cs.staff_id = v_staff_id;

  IF v_allowed_sessions IS NULL THEN
    v_allowed_sessions := ARRAY[]::UUID[];
  END IF;

  FOR v_assignments_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignments, '[]'::jsonb))
  LOOP
    v_session_id := (v_assignments_elem->>'session_id')::UUID;
    IF v_session_id IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT (v_session_id = ANY(v_allowed_sessions)) THEN
      RAISE EXCEPTION 'forbidden: session not in your UCAT classes';
    END IF;

    DELETE FROM public.ucat_sessions_resources WHERE session_id = v_session_id;

    v_resources := v_assignments_elem->'resources';
    IF jsonb_typeof(v_resources) = 'array' THEN
      v_idx := 0;
      FOR v_resource IN SELECT * FROM jsonb_array_elements(v_resources)
      LOOP
        v_question_set_id := NULL;
        v_ucat_mock_id := NULL;
        v_question_stem_id := NULL;
        v_learning_module_id := NULL;

        IF (v_resource->>'resource_type') = 'set' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_question_set_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'mock' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_ucat_mock_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'stem' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_question_stem_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'lesson' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_learning_module_id := (v_resource->>'resource_id')::UUID;
          IF NOT EXISTS (
            SELECT 1 FROM public.ucat_learning_modules lm
            WHERE lm.id = v_learning_module_id
              AND lm.kind = 'lesson'
              AND lm.deleted_at IS NULL
          ) THEN
            RAISE EXCEPTION 'invalid_learning_module_lesson';
          END IF;
        END IF;

        IF v_question_set_id IS NOT NULL
          OR v_ucat_mock_id IS NOT NULL
          OR v_question_stem_id IS NOT NULL
          OR v_learning_module_id IS NOT NULL
        THEN
          INSERT INTO public.ucat_sessions_resources (
            session_id,
            question_set_id,
            ucat_mock_id,
            question_stem_id,
            ucat_learning_module_id,
            index,
            created_by
          )
          VALUES (
            v_session_id,
            v_question_set_id,
            v_ucat_mock_id,
            v_question_stem_id,
            v_learning_module_id,
            COALESCE((v_resource->>'index')::INT, v_idx),
            v_staff_id
          );
        END IF;
        v_idx := v_idx + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.tutor_ucat_replace_sessions_resources(JSONB) IS
  'Replace UCAT session resources (set, mock, stem, or learning module lesson).';
