-- UCAT: Create student_practice_sessions for persistent practice (Option B)
-- Description: Base table for practice sessions; students read via view, write via API.
-- Date: 2026-03-18

-- student_practice_sessions
CREATE TABLE IF NOT EXISTS public.student_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ucat_section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  filters_snapshot JSONB,
  stems_snapshot JSONB,
  score_points NUMERIC,
  total_points NUMERIC,
  question_count INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  unlimited BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_student_practice_sessions_student ON public.student_practice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_practice_sessions_completed ON public.student_practice_sessions(completed_at) WHERE completed_at IS NOT NULL;

-- Alter student_question_attempts: add student_practice_session_id
ALTER TABLE public.student_question_attempts
  ADD COLUMN IF NOT EXISTS student_practice_session_id UUID REFERENCES public.student_practice_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_student_question_attempts_practice_session ON public.student_question_attempts(student_practice_session_id) WHERE student_practice_session_id IS NOT NULL;

-- RLS: Enable on student_practice_sessions, ADMINSTAFF full access
ALTER TABLE public.student_practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_practice_sessions" ON public.student_practice_sessions;
CREATE POLICY "ADMINSTAFF full access to student_practice_sessions" ON public.student_practice_sessions
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- vstudent_ucat_my_practice_sessions: student-readable practice sessions
CREATE OR REPLACE VIEW public.vstudent_ucat_my_practice_sessions
WITH (security_invoker = false)
AS
SELECT
  sps.id,
  sps.student_id,
  sps.ucat_section_id,
  us.name AS section_name,
  sps.section_key,
  sps.score_points,
  sps.total_points,
  sps.question_count,
  sps.started_at,
  sps.completed_at,
  sps.unlimited
FROM public.student_practice_sessions sps
JOIN public.ucat_sections us ON us.id = sps.ucat_section_id
WHERE public.is_ucat_student() AND sps.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_practice_sessions TO authenticated;

-- vstudent_ucat_my_question_attempts: add student_practice_session_id
DROP VIEW IF EXISTS public.vstudent_ucat_my_question_attempts;
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
WHERE public.is_ucat_student() AND sqa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;
