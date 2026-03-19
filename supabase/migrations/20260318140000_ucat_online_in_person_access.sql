-- UCAT: Online vs in-person student access
-- - Online (subscription trialing/active): public mocks/sets/stems + practice; full nav.
-- - In-person (UCAT class enrollment): session-assigned resources only (incl. private); dashboard, progress, sessions.
-- - Both: union of access rules.
-- Adds question_stem_id to ucat_sessions_resources + tutor_ucat_assign_stem_sessions RPC.

-- ========================
-- 1) ucat_sessions_resources: allow individual stems
-- ========================
ALTER TABLE public.ucat_sessions_resources DROP CONSTRAINT IF EXISTS ucat_sessions_resources_one_resource;

ALTER TABLE public.ucat_sessions_resources
  ADD COLUMN IF NOT EXISTS question_stem_id UUID REFERENCES public.question_stems(id) ON DELETE CASCADE;

ALTER TABLE public.ucat_sessions_resources
  ADD CONSTRAINT ucat_sessions_resources_one_resource CHECK (
    (CASE WHEN ucat_mock_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN question_set_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN question_stem_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_sessions_resources_session_stem_unique
  ON public.ucat_sessions_resources (session_id, question_stem_id) WHERE question_stem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ucat_sessions_resources_stem
  ON public.ucat_sessions_resources(question_stem_id) WHERE question_stem_id IS NOT NULL;

-- ========================
-- 2) Access helpers (replace is_ucat_student = online OR in-person)
-- ========================
CREATE OR REPLACE FUNCTION public.is_ucat_in_person_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.classes_students cs ON c.id = cs.class_id
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cs.student_id = public.current_student_id()
      AND cs.unenrolled_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_in_person_student() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_ucat_online_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_ucat_subscriptions s
    WHERE s.student_id = public.current_student_id()
      AND s.status IN ('trialing', 'active')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_online_student() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_ucat_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_ucat_in_person_student() OR public.is_ucat_online_student();
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_student() TO authenticated;

COMMENT ON FUNCTION public.is_ucat_in_person_student() IS 'UCAT class enrollment (unenrolled_at IS NULL). Session-assigned content access.';
COMMENT ON FUNCTION public.is_ucat_online_student() IS 'Active UCAT subscription (trialing or active). Public catalog + practice.';
COMMENT ON FUNCTION public.is_ucat_student() IS 'Any UCAT access: in-person and/or online subscription.';

-- Per-resource access (SECURITY DEFINER; uses current_student_id)
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_question_stem(p_question_stem_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.question_stems qs
      WHERE qs.id = p_question_stem_id AND qs.deleted_at IS NULL
    )
    AND (
      (
        public.is_ucat_online_student()
        AND EXISTS (
          SELECT 1 FROM public.question_stems qs
          WHERE qs.id = p_question_stem_id AND qs.is_private = false AND qs.deleted_at IS NULL
        )
      )
      OR
      (
        public.is_ucat_in_person_student()
        AND EXISTS (
          SELECT 1
          FROM public.ucat_sessions_resources usr
          JOIN public.sessions sess ON sess.id = usr.session_id
          JOIN public.classes c ON c.id = sess.class_id
          JOIN public.classes_students cs ON cs.class_id = c.id AND cs.student_id = public.current_student_id()
          WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
            AND cs.unenrolled_at IS NULL
            AND (
              usr.question_stem_id = p_question_stem_id
              OR (
                usr.question_set_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM public.question_stems_question_sets qsq
                  WHERE qsq.question_set_id = usr.question_set_id
                    AND qsq.question_stem_id = p_question_stem_id
                )
              )
              OR (
                usr.ucat_mock_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM public.question_sets_ucat_mocks qsum
                  JOIN public.question_stems_question_sets qsq ON qsq.question_set_id = qsum.question_set_id
                  WHERE qsum.ucat_mock_id = usr.ucat_mock_id
                    AND qsq.question_stem_id = p_question_stem_id
                )
              )
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_question_stem(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_question_set(p_question_set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = p_question_set_id AND qs.deleted_at IS NULL
    )
    AND (
      (
        public.is_ucat_online_student()
        AND EXISTS (
          SELECT 1 FROM public.question_sets qs
          WHERE qs.id = p_question_set_id AND qs.is_private = false
        )
      )
      OR
      (
        public.is_ucat_in_person_student()
        AND EXISTS (
          SELECT 1
          FROM public.ucat_sessions_resources usr
          JOIN public.sessions sess ON sess.id = usr.session_id
          JOIN public.classes c ON c.id = sess.class_id
          JOIN public.classes_students cs ON cs.class_id = c.id AND cs.student_id = public.current_student_id()
          WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
            AND cs.unenrolled_at IS NULL
            AND (
              usr.question_set_id = p_question_set_id
              OR (
                usr.ucat_mock_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM public.question_sets_ucat_mocks qsum
                  WHERE qsum.ucat_mock_id = usr.ucat_mock_id
                    AND qsum.question_set_id = p_question_set_id
                )
              )
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_question_set(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_ucat_mock(p_ucat_mock_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.ucat_mocks m
      WHERE m.id = p_ucat_mock_id AND m.deleted_at IS NULL
    )
    AND (
      (
        public.is_ucat_online_student()
        AND EXISTS (
          SELECT 1 FROM public.ucat_mocks m
          WHERE m.id = p_ucat_mock_id AND m.is_private = false
        )
      )
      OR
      (
        public.is_ucat_in_person_student()
        AND EXISTS (
          SELECT 1
          FROM public.ucat_sessions_resources usr
          JOIN public.sessions sess ON sess.id = usr.session_id
          JOIN public.classes c ON c.id = sess.class_id
          JOIN public.classes_students cs ON cs.class_id = c.id AND cs.student_id = public.current_student_id()
          WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
            AND cs.unenrolled_at IS NULL
            AND usr.ucat_mock_id = p_ucat_mock_id
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_mock(UUID) TO authenticated;

-- ========================
-- 3) Tutor RPC: assign stem to sessions
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_assign_stem_sessions(
  p_stem_id UUID,
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

  DELETE FROM public.ucat_sessions_resources WHERE question_stem_id = p_stem_id;

  INSERT INTO public.ucat_sessions_resources (session_id, question_stem_id, index, created_by)
  SELECT
    NULLIF(elem.value, '')::UUID,
    p_stem_id,
    (elem.ordinality - 1)::INTEGER,
    v_staff_id
  FROM jsonb_array_elements_text(COALESCE(p_session_ids, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
  WHERE NULLIF(elem.value, '')::UUID IS NOT NULL
  ON CONFLICT (session_id, question_stem_id) WHERE question_stem_id IS NOT NULL DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_assign_stem_sessions(UUID, JSONB) TO authenticated;

-- ========================
-- 4) Student access flags (for app nav)
-- ========================
CREATE OR REPLACE VIEW public.vstudent_ucat_my_access
WITH (security_invoker = false)
AS
SELECT
  public.is_ucat_online_student() AS has_online_access,
  public.is_ucat_in_person_student() AS has_in_person_access,
  (public.is_ucat_online_student() OR public.is_ucat_in_person_student()) AS has_ucat_access
WHERE (SELECT public.current_student_id()) IS NOT NULL;

GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

-- ========================
-- 5) vstudent_ucat_sessions_resources: expose stem column
-- ========================
DROP VIEW IF EXISTS public.vstudent_ucat_sessions_resources;

CREATE VIEW public.vstudent_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.index,
  usr.created_by,
  usr.created_at,
  usr.question_stem_id
FROM public.ucat_sessions_resources usr
JOIN public.sessions s ON s.id = usr.session_id
JOIN public.classes c ON c.id = s.class_id
JOIN public.classes_students cs ON cs.class_id = c.id
WHERE
  public.is_ucat_in_person_student()
  AND cs.student_id = public.current_student_id()
  AND cs.unenrolled_at IS NULL
  AND c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1);

GRANT SELECT ON public.vstudent_ucat_sessions_resources TO authenticated;

-- ========================
-- 6) Drop dependent student views (recreate below)
-- ========================
DROP VIEW IF EXISTS public.vstudent_ucat_my_progress_summary;
DROP VIEW IF EXISTS public.vstudent_ucat_my_question_attempts;
DROP VIEW IF EXISTS public.vstudent_ucat_my_practice_sessions;
DROP VIEW IF EXISTS public.vstudent_ucat_my_set_attempts;
DROP VIEW IF EXISTS public.vstudent_ucat_my_mock_attempts;
DROP VIEW IF EXISTS public.vstudent_ucat_public_question_counts;
DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;
DROP VIEW IF EXISTS public.vstudent_ucat_question_stems;
DROP VIEW IF EXISTS public.vstudent_ucat_question_set_detail;
DROP VIEW IF EXISTS public.vstudent_ucat_question_sets;
DROP VIEW IF EXISTS public.vstudent_ucat_mock_detail;
DROP VIEW IF EXISTS public.vstudent_ucat_mocks;

-- ========================
-- 7) Catalog views (stems, sets, mocks, detail)
-- ========================
CREATE VIEW public.vstudent_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND public.can_student_access_ucat_question_stem(qs.id);

GRANT SELECT ON public.vstudent_ucat_question_stems TO authenticated;

CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  us.instructions_text AS section_instructions_text,
  us.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  us.time_limit_seconds AS section_time_limit_seconds,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'answer_explanation', q.answer_explanation,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'selection_count', (
                SELECT COUNT(*)::int
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id = qao.id
                  AND sqa.is_submitted = true
              ),
              'total_answered', (
                SELECT COUNT(*)::int
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id IS NOT NULL
                  AND sqa.is_submitted = true
              ),
              'percentage', COALESCE(
                ROUND(
                  100.0 * (
                    SELECT COUNT(*)::numeric
                    FROM public.student_question_attempts sqa
                    WHERE sqa.question_id = q.id
                      AND sqa.question_answer_option_id = qao.id
                      AND sqa.is_submitted = true
                  ) / NULLIF((
                    SELECT COUNT(*)::numeric
                    FROM public.student_question_attempts sqa
                    WHERE sqa.question_id = q.id
                      AND sqa.question_answer_option_id IS NOT NULL
                      AND sqa.is_submitted = true
                  ), 0),
                  1
                ),
                0
              )
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id AND qao.deleted_at IS NULL
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id AND q.deleted_at IS NULL
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND public.can_student_access_ucat_question_stem(qs.id);

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

CREATE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at
FROM public.question_sets qs
WHERE public.is_ucat_student() AND public.can_student_access_ucat_question_set(qs.id);

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

CREATE VIEW public.vstudent_ucat_question_set_detail
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
        'questions_meta', (
          SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index)
          FROM public.ucat_questions q
          WHERE q.question_stem_id = qsq.question_stem_id AND q.deleted_at IS NULL
        )
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id AND st.deleted_at IS NULL
    WHERE qsq.question_set_id = qs.id
      AND public.can_student_access_ucat_question_stem(st.id)
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_student() AND public.can_student_access_ucat_question_set(qs.id);

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

CREATE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  m.created_by,
  (SELECT COUNT(*)::INT
   FROM public.question_sets_ucat_mocks qsum
   WHERE qsum.ucat_mock_id = m.id
     AND public.can_student_access_ucat_question_set(qsum.question_set_id)) AS set_count,
  (
    SELECT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks qsum
      JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.deleted_at IS NULL
      WHERE qsum.ucat_mock_id = m.id
        AND public.can_student_access_ucat_question_set(qsum.question_set_id)
        AND qs.time_limit_seconds IS NOT NULL
        AND qs.time_limit_seconds > 0
    )
  ) AS has_timed_sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND public.can_student_access_ucat_mock(m.id);

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;

CREATE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.instructions_text,
  m.created_at,
  m.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'id', qs.id,
        'name', qs.name,
        'description', qs.description,
        'time_limit_seconds', qs.time_limit_seconds
      ) ORDER BY qsum.index
    )
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.deleted_at IS NULL
    WHERE qsum.ucat_mock_id = m.id
      AND public.can_student_access_ucat_question_set(qs.id)
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND public.can_student_access_ucat_mock(m.id);

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

-- ========================
-- 8) Attempts, practice sessions, progress aggregates
-- ========================
CREATE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT sqsa.*
FROM public.student_question_set_attempts sqsa
WHERE public.is_ucat_student()
  AND sqsa.student_id = public.current_student_id()
  AND public.can_student_access_ucat_question_set(sqsa.question_set_id);

GRANT SELECT ON public.vstudent_ucat_my_set_attempts TO authenticated;

CREATE VIEW public.vstudent_ucat_my_mock_attempts
WITH (security_invoker = false)
AS
SELECT suma.*
FROM public.student_ucat_mock_attempts suma
WHERE public.is_ucat_student()
  AND suma.student_id = public.current_student_id()
  AND public.can_student_access_ucat_mock(suma.ucat_mock_id);

GRANT SELECT ON public.vstudent_ucat_my_mock_attempts TO authenticated;

CREATE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  sqa.student_question_set_attempt_id,
  sqa.student_practice_session_id,
  sqa.question_id,
  q.question_stem_id,
  q.index AS question_index,
  q.question_text,
  q.question_type,
  q.time_burden_seconds,
  st.stem_text,
  st.question_stem_category_id,
  qsc.name AS category_name,
  us.id AS ucat_section_id,
  us.name AS section_name,
  us.section_number,
  sqa.question_answer_option_id,
  qao.answer_text AS selected_answer_text,
  sqa.answer_snapshot,
  sqa.score,
  sqa.is_flagged,
  sqa.is_submitted,
  sqa.attempted_at,
  sqa.time_spent_seconds,
  sqa.student_question_speed,
  sqa.was_timed,
  sqa.mode
FROM public.student_question_attempts sqa
JOIN public.ucat_questions q ON q.id = sqa.question_id
JOIN public.question_stems st ON st.id = q.question_stem_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao ON qao.id = sqa.question_answer_option_id
WHERE public.is_ucat_student()
  AND sqa.student_id = public.current_student_id()
  AND public.can_student_access_ucat_question_stem(st.id);

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

CREATE VIEW public.vstudent_ucat_my_practice_sessions
WITH (security_invoker = false)
AS
SELECT
  sps.id,
  sps.student_id,
  sps.ucat_section_id,
  us.name AS section_name,
  sps.section_key,
  sps.stems_snapshot,
  sps.score_points,
  sps.total_points,
  sps.question_count,
  sps.started_at,
  sps.completed_at,
  sps.unlimited
FROM public.student_practice_sessions sps
JOIN public.ucat_sections us ON us.id = sps.ucat_section_id
WHERE public.is_ucat_online_student()
  AND sps.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_practice_sessions TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH stem_scores AS (
  SELECT
    st.id,
    st.section_id,
    st.question_stem_category_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.ucat_questions q
        WHERE q.question_stem_id = st.id
          AND q.question_type = 'syllogism'
          AND q.deleted_at IS NULL
      ) THEN 2
      ELSE 1
    END AS max_score
  FROM public.question_stems st
  WHERE st.deleted_at IS NULL
    AND public.can_student_access_ucat_question_stem(st.id)
    AND EXISTS (
      SELECT 1
      FROM public.ucat_questions q
      WHERE q.question_stem_id = st.id
        AND q.deleted_at IS NULL
    )
)
SELECT
  section_id,
  question_stem_category_id,
  SUM(max_score)::int AS total_questions
FROM stem_scores
GROUP BY section_id, question_stem_category_id;

GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;

CREATE VIEW public.vstudent_ucat_my_progress_summary
WITH (security_invoker = false)
AS
SELECT
  public.current_student_id() AS student_id,
  (SELECT COUNT(*)::INT
   FROM public.student_question_set_attempts sqsa
   WHERE sqsa.student_id = public.current_student_id()
     AND sqsa.completed_at IS NOT NULL
     AND public.can_student_access_ucat_question_set(sqsa.question_set_id)) AS total_sets_attempted,
  (SELECT COUNT(*)::INT
   FROM public.student_ucat_mock_attempts suma
   WHERE suma.student_id = public.current_student_id()
     AND suma.completed_at IS NOT NULL
     AND public.can_student_access_ucat_mock(suma.ucat_mock_id)) AS total_mocks_attempted,
  (SELECT AVG(sqsa.score_points)
   FROM public.student_question_set_attempts sqsa
   WHERE sqsa.student_id = public.current_student_id()
     AND sqsa.completed_at IS NOT NULL
     AND public.can_student_access_ucat_question_set(sqsa.question_set_id)) AS avg_score_points,
  (SELECT AVG(sqsa.scaled_score)
   FROM public.student_question_set_attempts sqsa
   WHERE sqsa.student_id = public.current_student_id()
     AND sqsa.completed_at IS NOT NULL
     AND public.can_student_access_ucat_question_set(sqsa.question_set_id)) AS avg_scaled_score,
  (SELECT MAX(sqsa.attempted_at)
   FROM public.student_question_set_attempts sqsa
   WHERE sqsa.student_id = public.current_student_id()
     AND public.can_student_access_ucat_question_set(sqsa.question_set_id)) AS last_attempted_at
FROM public.students s
WHERE s.id = public.current_student_id() AND public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_my_progress_summary TO authenticated;

-- ========================
-- 9) Batch replace RPC: support resource_type "stem"
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
        IF (v_resource->>'resource_type') = 'set' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_question_set_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'mock' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_ucat_mock_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'stem' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_question_stem_id := (v_resource->>'resource_id')::UUID;
        END IF;
        IF v_question_set_id IS NOT NULL OR v_ucat_mock_id IS NOT NULL OR v_question_stem_id IS NOT NULL THEN
          INSERT INTO public.ucat_sessions_resources (
            session_id,
            question_set_id,
            ucat_mock_id,
            question_stem_id,
            index,
            created_by
          )
          VALUES (
            v_session_id,
            v_question_set_id,
            v_ucat_mock_id,
            v_question_stem_id,
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

COMMENT ON FUNCTION public.tutor_ucat_replace_sessions_resources(JSONB) IS 'Replace UCAT session resources (set, mock, or stem). Tutor must be assigned to the session class.';
