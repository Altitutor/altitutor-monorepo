-- ========================
-- UCAT: Link sets to stems (not questions), add name to question_sets
-- 1. Add name JSONB to question_sets
-- 2. Rename questions_sets -> question_stems_question_sets, question_id -> question_stem_id
-- 3. Migrate data (aggregate by stem per set), drop old table
-- 4. Update triggers, RLS, views, and tutor RPC
-- ========================

-- 1. Add name JSONB to question_sets (same pattern as description)
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS name JSONB;

-- 2. Create new junction table: question_stems_question_sets
CREATE TABLE IF NOT EXISTS public.question_stems_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_stems_question_sets_set ON public.question_stems_question_sets(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_stems_question_sets_stem ON public.question_stems_question_sets(question_stem_id);

-- 3. Migrate data: one row per (set, stem) with stem order = min(question index) within that set
INSERT INTO public.question_stems_question_sets (
  question_stem_id,
  question_set_id,
  index,
  created_at,
  created_by,
  updated_at,
  updated_by
)
SELECT
  stem_set.question_stem_id,
  stem_set.question_set_id,
  stem_set.rn::INTEGER,
  stem_set.created_at,
  stem_set.created_by,
  stem_set.updated_at,
  stem_set.updated_by
FROM (
  SELECT
    q.question_stem_id,
    qs.question_set_id,
    ROW_NUMBER() OVER (PARTITION BY qs.question_set_id ORDER BY MIN(qs.index)) AS rn,
    MIN(qs.created_at) AS created_at,
    (ARRAY_AGG(qs.created_by) FILTER (WHERE qs.created_by IS NOT NULL))[1] AS created_by,
    MAX(qs.updated_at) AS updated_at,
    (ARRAY_AGG(qs.updated_by) FILTER (WHERE qs.updated_by IS NOT NULL))[1] AS updated_by
  FROM public.questions_sets qs
  JOIN public.ucat_questions q ON q.id = qs.question_id
  GROUP BY q.question_stem_id, qs.question_set_id
) stem_set;

-- 4. Drop views that depend on questions_sets, then drop table (triggers dropped with table)
DROP VIEW IF EXISTS public.vtutor_ucat_question_set_detail;
DROP VIEW IF EXISTS public.vstudent_ucat_question_set_detail;
DROP TRIGGER IF EXISTS set_updated_at_questions_sets ON public.questions_sets;
DROP TABLE IF EXISTS public.questions_sets;

-- 5. Trigger and RLS for new table
CREATE TRIGGER set_updated_at_question_stems_question_sets
  BEFORE UPDATE ON public.question_stems_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.question_stems_question_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to question_stems_question_sets" ON public.question_stems_question_sets;
CREATE POLICY "ADMINSTAFF full access to question_stems_question_sets"
  ON public.question_stems_question_sets
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- 6. Recreate vtutor_ucat_question_sets with name column (must DROP first when adding columns)
DROP VIEW IF EXISTS public.vtutor_ucat_question_sets;
CREATE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name
FROM public.question_sets qs
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;

-- 7. vtutor_ucat_question_set_detail: use question_stems_question_sets, stems ordered by index; questions_meta = all questions of that stem
CREATE OR REPLACE VIEW public.vtutor_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  (
    SELECT json_agg(
      json_build_object(
        'stem_id', st.id,
        'stem_text', st.stem_text,
        'questions_meta', (SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index) FROM public.ucat_questions q WHERE q.question_stem_id = qsq.question_stem_id)
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id
    WHERE qsq.question_set_id = qs.id
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;

-- 8. vtutor_ucat_mock_detail: include name in set json
CREATE OR REPLACE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;

-- 9. vstudent_ucat_question_sets: add name (must DROP first when adding columns)
DROP VIEW IF EXISTS public.vstudent_ucat_question_sets;
CREATE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.created_at,
  qs.updated_at
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

-- 10. vstudent_ucat_question_set_detail: use question_stems_question_sets
CREATE OR REPLACE VIEW public.vstudent_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'stem_id', st.id,
        'stem_text', st.stem_text,
        'questions_meta', (SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index) FROM public.ucat_questions q WHERE q.question_stem_id = qsq.question_stem_id)
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id
    WHERE qsq.question_set_id = qs.id
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

-- 11. vstudent_ucat_mock_detail: include name in set json
CREATE OR REPLACE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.is_private = false
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false;

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

-- 12. Update tutor RPC: tutor_ucat_upsert_question_set now takes p_stem_ids (and p_name)
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_set(
  p_set_id UUID,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_is_private BOOLEAN,
  p_is_student_generated BOOLEAN,
  p_stem_ids JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_set_id IS NULL THEN
    INSERT INTO public.question_sets (
      name,
      description,
      time_limit_seconds,
      is_private,
      is_student_generated,
      created_by,
      updated_by
    ) VALUES (
      p_name,
      p_description,
      p_time_limit_seconds,
      COALESCE(p_is_private, false),
      COALESCE(p_is_student_generated, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_set_id;
  ELSE
    UPDATE public.question_sets
    SET name = p_name,
        description = p_description,
        time_limit_seconds = p_time_limit_seconds,
        is_private = COALESCE(p_is_private, false),
        is_student_generated = COALESCE(p_is_student_generated, false),
        updated_by = v_staff_id
    WHERE id = p_set_id
    RETURNING id INTO v_set_id;

    IF v_set_id IS NULL THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;

    DELETE FROM public.question_stems_question_sets WHERE question_set_id = v_set_id;
  END IF;

  FOR v_stem_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_stem_ids, '[]'::jsonb))
  LOOP
    IF v_stem_id IS NOT NULL THEN
      v_index := v_index + 1;
      INSERT INTO public.question_stems_question_sets (
        question_stem_id,
        question_set_id,
        index,
        created_by,
        updated_by
      ) VALUES (
        v_stem_id,
        v_set_id,
        v_index,
        v_staff_id,
        v_staff_id
      );
    END IF;
  END LOOP;

  RETURN v_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
