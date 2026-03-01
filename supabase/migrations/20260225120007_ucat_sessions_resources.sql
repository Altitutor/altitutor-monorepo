-- ========================
-- UCAT: Replace mocks_sessions and question_sets_sessions with ucat_sessions_resources
-- One table: session_id + exactly one of ucat_mock_id or question_set_id, with index for ordering.
-- ========================

-- 1. Create new base table
CREATE TABLE public.ucat_sessions_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  ucat_mock_id UUID REFERENCES public.ucat_mocks(id) ON DELETE CASCADE,
  question_set_id UUID REFERENCES public.question_sets(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ucat_sessions_resources_one_resource CHECK (
    (ucat_mock_id IS NOT NULL AND question_set_id IS NULL)
    OR (ucat_mock_id IS NULL AND question_set_id IS NOT NULL)
  )
);

CREATE INDEX idx_ucat_sessions_resources_session ON public.ucat_sessions_resources(session_id);
CREATE INDEX idx_ucat_sessions_resources_mock ON public.ucat_sessions_resources(ucat_mock_id) WHERE ucat_mock_id IS NOT NULL;
CREATE INDEX idx_ucat_sessions_resources_set ON public.ucat_sessions_resources(question_set_id) WHERE question_set_id IS NOT NULL;

-- Partial unique: one row per (session, set) or per (session, mock)
CREATE UNIQUE INDEX idx_ucat_sessions_resources_session_set_unique
  ON public.ucat_sessions_resources (session_id, question_set_id) WHERE question_set_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ucat_sessions_resources_session_mock_unique
  ON public.ucat_sessions_resources (session_id, ucat_mock_id) WHERE ucat_mock_id IS NOT NULL;

-- 2. Migrate existing data (preserve order by created_at within each session)
INSERT INTO public.ucat_sessions_resources (session_id, question_set_id, index, created_by, created_at)
SELECT
  qss.session_id,
  qss.question_set_id,
  (row_number() OVER (PARTITION BY qss.session_id ORDER BY qss.created_at))::INTEGER - 1,
  qss.created_by,
  qss.created_at
FROM public.question_sets_sessions qss;

INSERT INTO public.ucat_sessions_resources (session_id, ucat_mock_id, index, created_by, created_at)
SELECT
  ms.session_id,
  ms.ucat_mock_id,
  (row_number() OVER (PARTITION BY ms.session_id ORDER BY ms.created_at))::INTEGER - 1,
  ms.created_by,
  ms.created_at
FROM public.mocks_sessions ms;

-- 3. Drop dependent views
DROP VIEW IF EXISTS public.vtutor_ucat_question_sets_sessions;
DROP VIEW IF EXISTS public.vtutor_ucat_mocks_sessions;

-- 4. Drop RPCs that write to old tables
DROP FUNCTION IF EXISTS public.tutor_ucat_assign_set_sessions(UUID, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_assign_mock_sessions(UUID, JSONB);

-- 5. Drop old tables
DROP TABLE IF EXISTS public.question_sets_sessions;
DROP TABLE IF EXISTS public.mocks_sessions;

-- 6. RLS and policy for new table
ALTER TABLE public.ucat_sessions_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_sessions_resources" ON public.ucat_sessions_resources;
CREATE POLICY "ADMINSTAFF full access to ucat_sessions_resources"
  ON public.ucat_sessions_resources FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- 7. Tutor view: ucat tutors can read
CREATE VIEW public.vtutor_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT usr.*
FROM public.ucat_sessions_resources usr
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_sessions_resources TO authenticated;

-- 8. Recreate assign RPCs to use ucat_sessions_resources (index = array order)
CREATE OR REPLACE FUNCTION public.tutor_ucat_assign_set_sessions(
  p_set_id UUID,
  p_session_ids JSONB
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

  v_staff_id := public.current_tutor_id();

  DELETE FROM public.ucat_sessions_resources WHERE question_set_id = p_set_id;

  INSERT INTO public.ucat_sessions_resources (session_id, question_set_id, index, created_by)
  SELECT
    NULLIF(elem.value, '')::UUID,
    p_set_id,
    (elem.ordinality - 1)::INTEGER,
    v_staff_id
  FROM jsonb_array_elements_text(COALESCE(p_session_ids, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
  WHERE NULLIF(elem.value, '')::UUID IS NOT NULL
  ON CONFLICT (session_id, question_set_id) WHERE question_set_id IS NOT NULL DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_assign_set_sessions(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_assign_mock_sessions(
  p_mock_id UUID,
  p_session_ids JSONB
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

  v_staff_id := public.current_tutor_id();

  DELETE FROM public.ucat_sessions_resources WHERE ucat_mock_id = p_mock_id;

  INSERT INTO public.ucat_sessions_resources (session_id, ucat_mock_id, index, created_by)
  SELECT
    NULLIF(elem.value, '')::UUID,
    p_mock_id,
    (elem.ordinality - 1)::INTEGER,
    v_staff_id
  FROM jsonb_array_elements_text(COALESCE(p_session_ids, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
  WHERE NULLIF(elem.value, '')::UUID IS NOT NULL
  ON CONFLICT (session_id, ucat_mock_id) WHERE ucat_mock_id IS NOT NULL DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_assign_mock_sessions(UUID, JSONB) TO authenticated;
