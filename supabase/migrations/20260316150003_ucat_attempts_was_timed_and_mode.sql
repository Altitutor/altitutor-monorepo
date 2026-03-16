-- UCAT: Add was_timed and mode to student question/set attempts; add timing aggregates to mock attempts
-- Description: Track whether attempts were timed and which question engine mode was used.
-- student_question_set_attempts: was_timed = true when set has time limit > 0
-- student_question_attempts: was_timed = true when question was in a timed set; mode = question|question_stem|set|mock
-- student_ucat_mock_attempts: time_taken, mock_time_limit_seconds, mock_time_limit_at_exam_speed_seconds, student_mock_speed (aggregated from child set attempts)
-- Date: 2026-03-16

-- 1. student_ucat_mock_attempts: add timing aggregate columns (populated when mock completed, same pattern as score_points)
-- time_taken = SUM(time_taken_seconds) from child set attempts
-- mock_time_limit_seconds = SUM(set_time_limit_seconds) from child set attempts
-- mock_time_limit_at_exam_speed_seconds = SUM(set_time_limit_at_exam_speed_seconds) from child set attempts
-- student_mock_speed = mock_time_limit_seconds / time_taken (same formula as set_speed)
ALTER TABLE public.student_ucat_mock_attempts
  ADD COLUMN IF NOT EXISTS time_taken INTEGER,
  ADD COLUMN IF NOT EXISTS mock_time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS mock_time_limit_at_exam_speed_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS student_mock_speed NUMERIC;

-- 2. student_question_set_attempts: add was_timed
ALTER TABLE public.student_question_set_attempts
  ADD COLUMN IF NOT EXISTS was_timed BOOLEAN NOT NULL DEFAULT false;

-- 3. student_question_attempts: add was_timed and mode
ALTER TABLE public.student_question_attempts
  ADD COLUMN IF NOT EXISTS was_timed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mode TEXT;

-- Constrain mode to allowed values
ALTER TABLE public.student_question_attempts
  DROP CONSTRAINT IF EXISTS student_question_attempts_mode_check;
ALTER TABLE public.student_question_attempts
  ADD CONSTRAINT student_question_attempts_mode_check
  CHECK (mode IS NULL OR mode IN ('question', 'question_stem', 'set', 'mock'));

-- 4. vstudent_ucat_my_question_attempts: add was_timed, mode
CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  sqa.student_question_set_attempt_id,
  sqa.question_id,
  q.question_stem_id,
  q.index AS question_index,
  q.question_text,
  q.question_type,
  q.time_burden_seconds,
  st.stem_text,
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
JOIN public.ucat_sections us ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao ON qao.id = sqa.question_answer_option_id
WHERE public.is_ucat_student() AND sqa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

-- 5. vtutor_ucat_student_question_attempts: add was_timed, mode
CREATE OR REPLACE VIEW public.vtutor_ucat_student_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  sqa.student_question_set_attempt_id,
  sqa.question_id,
  sqa.question_answer_option_id,
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
JOIN public.students s ON s.id = sqa.student_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqa.student_id);

-- 6. vtutor_ucat_student_set_attempts: add was_timed
DROP VIEW IF EXISTS public.vtutor_ucat_student_set_attempts;
CREATE VIEW public.vtutor_ucat_student_set_attempts
WITH (security_invoker = false)
AS
SELECT
  sqsa.id AS attempt_id,
  sqsa.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  sqsa.question_set_id AS set_id,
  qs.description AS set_name,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.set_time_limit_seconds,
  sqsa.set_time_limit_at_exam_speed_seconds,
  sqsa.set_speed,
  sqsa.student_set_speed,
  sqsa.student_exam_speed,
  sqsa.was_timed,
  sqsa.attempted_at,
  sqsa.completed_at
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);

-- 7. vtutor_ucat_student_set_attempt_detail: add was_timed
DROP VIEW IF EXISTS public.vtutor_ucat_student_set_attempt_detail;
CREATE VIEW public.vtutor_ucat_student_set_attempt_detail
WITH (security_invoker = false)
AS
SELECT
  sqsa.id AS attempt_id,
  sqsa.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  sqsa.question_set_id,
  qs.description AS set_description,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.time_taken_seconds,
  sqsa.set_time_limit_seconds,
  sqsa.set_time_limit_at_exam_speed_seconds,
  sqsa.set_speed,
  sqsa.student_set_speed,
  sqsa.student_exam_speed,
  sqsa.was_timed,
  sqsa.attempted_at,
  sqsa.completed_at,
  (
    SELECT json_agg(
      json_build_object(
        'question_id', q.id,
        'stem_id', q.question_stem_id,
        'index', q.index,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'student_score', sqa.score,
        'student_question_speed', sqa.student_question_speed,
        'was_correct', (sqa.score > 0),
        'student_answer_snapshot', sqa.answer_snapshot,
        'correct_answer_summary', (
          SELECT json_build_object(
            'correct_option_id', (
              SELECT qao.id
              FROM public.question_answer_options qao
              WHERE qao.question_id = q.id AND qao.is_answer
              LIMIT 1
            )
          )
        )
      )
      ORDER BY q.index
    )
    FROM public.student_question_attempts sqa
    JOIN public.ucat_questions q ON q.id = sqa.question_id
    WHERE sqa.student_question_set_attempt_id = sqsa.id
      AND sqa.is_submitted
  ) AS questions
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);
