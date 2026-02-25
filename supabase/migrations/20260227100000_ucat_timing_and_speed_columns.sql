-- ========================
-- UCAT: Section timing, set exam-speed timing, and attempt speed metrics
-- 1. ucat_sections: time_limit_seconds, number_of_questions, time_per_question (generated)
-- 2. question_sets: sections (JSONB), time_limit_at_exam_speed_seconds, speed (trigger-maintained)
-- 3. student_question_attempts: student_question_speed (set once when time_spent_seconds available)
-- 4. student_question_set_attempts: set_* snapshot and student_* speed columns (set at creation/completion)
-- 5. Update tutor/student views for sections, sets, and attempts
-- ========================

-- 1. ucat_sections: add time_limit_seconds, number_of_questions, time_per_question
ALTER TABLE public.ucat_sections
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS number_of_questions INTEGER;

-- time_per_question = time_limit_seconds / number_of_questions (seconds per question; NULL if either is null or number_of_questions = 0)
ALTER TABLE public.ucat_sections
  ADD COLUMN IF NOT EXISTS time_per_question NUMERIC GENERATED ALWAYS AS (
    CASE WHEN number_of_questions IS NOT NULL AND number_of_questions > 0 AND time_limit_seconds IS NOT NULL
      THEN time_limit_seconds::NUMERIC / number_of_questions
      ELSE NULL
    END
  ) STORED;

-- 2. question_sets: add sections, time_limit_at_exam_speed_seconds, speed (maintained by trigger)
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS sections JSONB,
  ADD COLUMN IF NOT EXISTS time_limit_at_exam_speed_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS speed NUMERIC;

-- Function: recompute question_sets timing columns for one set (sections array, time at exam speed, speed ratio)
CREATE OR REPLACE FUNCTION public.ucat_recompute_question_set_timing(p_question_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID := p_question_set_id;
  v_time_limit_seconds INTEGER;
  v_sections_json JSONB;
  v_time_at_exam NUMERIC := 0;
  v_sec RECORD;
  v_q_count INT;
BEGIN
  SELECT qs.time_limit_seconds INTO v_time_limit_seconds
  FROM public.question_sets qs WHERE qs.id = v_set_id;
  IF v_set_id IS NULL THEN
    RETURN;
  END IF;

  -- Build sections array: distinct sections in set order (by min stem index), with section_number, name, time_per_question
  WITH set_stems AS (
    SELECT qsq.question_stem_id, qsq.index AS stem_index
    FROM public.question_stems_question_sets qsq
    WHERE qsq.question_set_id = v_set_id
  ),
  section_agg AS (
    SELECT
      us.id AS section_id,
      us.section_number,
      us.name,
      us.time_per_question,
      MIN(ss.stem_index) AS min_idx
    FROM set_stems ss
    JOIN public.question_stems st ON st.id = ss.question_stem_id
    JOIN public.ucat_sections us ON us.id = st.section_id
    GROUP BY us.id, us.section_number, us.name, us.time_per_question
  )
  SELECT json_agg(
    json_build_object(
      'section_number', sa.section_number,
      'name', sa.name,
      'time_per_question', sa.time_per_question
    ) ORDER BY sa.min_idx
  ) INTO v_sections_json
  FROM section_agg sa;

  -- Sum (questions in section in this set) * (section time_per_question) for time_limit_at_exam_speed_seconds
  FOR v_sec IN
    SELECT
      us.id AS section_id,
      us.time_per_question,
      (SELECT COUNT(*)::INT
       FROM public.ucat_questions q
       INNER JOIN public.question_stems_question_sets qsq ON qsq.question_stem_id = q.question_stem_id AND qsq.question_set_id = v_set_id
       INNER JOIN public.question_stems st ON st.id = q.question_stem_id AND st.section_id = us.id
      ) AS q_count
    FROM public.question_sets qs
    CROSS JOIN LATERAL (
      SELECT DISTINCT st.section_id
      FROM public.question_stems_question_sets qsq
      JOIN public.question_stems st ON st.id = qsq.question_stem_id
      WHERE qsq.question_set_id = v_set_id
    ) x(section_id)
    JOIN public.ucat_sections us ON us.id = x.section_id
    WHERE qs.id = v_set_id
  LOOP
    v_q_count := v_sec.q_count;
    IF v_q_count > 0 AND v_sec.time_per_question IS NOT NULL THEN
      v_time_at_exam := v_time_at_exam + (v_q_count * v_sec.time_per_question);
    END IF;
  END LOOP;

  UPDATE public.question_sets
  SET
    sections = v_sections_json,
    time_limit_at_exam_speed_seconds = NULLIF(v_time_at_exam, 0),
    speed = CASE
      WHEN v_time_limit_seconds IS NOT NULL AND v_time_limit_seconds > 0 AND v_time_at_exam > 0
      THEN v_time_at_exam / v_time_limit_seconds
      ELSE NULL
    END
  WHERE id = v_set_id;
END;
$$;

-- Trigger: after change to question_stems_question_sets, recompute affected set(s)
CREATE OR REPLACE FUNCTION public.ucat_trigger_recompute_set_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.ucat_recompute_question_set_timing(OLD.question_set_id);
    RETURN OLD;
  END IF;
  PERFORM public.ucat_recompute_question_set_timing(NEW.question_set_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ucat_recompute_set_timing_on_stems ON public.question_stems_question_sets;
CREATE TRIGGER ucat_recompute_set_timing_on_stems
  AFTER INSERT OR UPDATE OR DELETE ON public.question_stems_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.ucat_trigger_recompute_set_timing();

-- Recompute when section time_per_question changes (section table has generated column, so we need trigger on section update)
CREATE OR REPLACE FUNCTION public.ucat_trigger_recompute_sets_for_section()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT qsq.question_set_id
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id
    WHERE st.section_id = COALESCE(NEW.id, OLD.id)
  LOOP
    PERFORM public.ucat_recompute_question_set_timing(r.question_set_id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ucat_recompute_sets_on_section_change ON public.ucat_sections;
CREATE TRIGGER ucat_recompute_sets_on_section_change
  AFTER UPDATE OF time_limit_seconds, number_of_questions ON public.ucat_sections
  FOR EACH ROW
  WHEN (OLD.time_limit_seconds IS DISTINCT FROM NEW.time_limit_seconds OR OLD.number_of_questions IS DISTINCT FROM NEW.number_of_questions)
  EXECUTE FUNCTION public.ucat_trigger_recompute_sets_for_section();

-- Backfill existing sets
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.question_sets LOOP
    PERFORM public.ucat_recompute_question_set_timing(r.id);
  END LOOP;
END $$;

-- 3. student_question_attempts: add student_question_speed (exam pace / actual time; >1 = faster than exam). Set once when time_spent_seconds is available.
ALTER TABLE public.student_question_attempts
  ADD COLUMN IF NOT EXISTS student_question_speed NUMERIC;

CREATE OR REPLACE FUNCTION public.ucat_set_student_question_speed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_per_q NUMERIC;
BEGIN
  IF NEW.time_spent_seconds IS NULL OR NEW.time_spent_seconds <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.student_question_speed IS NOT NULL THEN
    RETURN NEW; -- already set once
  END IF;
  SELECT us.time_per_question INTO v_time_per_q
  FROM public.ucat_questions q
  JOIN public.question_stems st ON st.id = q.question_stem_id
  JOIN public.ucat_sections us ON us.id = st.section_id
  WHERE q.id = NEW.question_id;
  IF v_time_per_q IS NOT NULL THEN
    NEW.student_question_speed := v_time_per_q / NEW.time_spent_seconds;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ucat_set_student_question_speed_trigger ON public.student_question_attempts;
CREATE TRIGGER ucat_set_student_question_speed_trigger
  BEFORE INSERT OR UPDATE OF time_spent_seconds ON public.student_question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.ucat_set_student_question_speed();

-- 4. student_question_set_attempts: add snapshot and speed columns (set at insert; student_* when time_taken_seconds set)
ALTER TABLE public.student_question_set_attempts
  ADD COLUMN IF NOT EXISTS set_time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS set_time_limit_at_exam_speed_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS set_speed NUMERIC,
  ADD COLUMN IF NOT EXISTS student_set_speed NUMERIC,
  ADD COLUMN IF NOT EXISTS student_exam_speed NUMERIC;

CREATE OR REPLACE FUNCTION public.ucat_set_attempt_snapshot_and_speed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qs RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT qs.time_limit_seconds, qs.time_limit_at_exam_speed_seconds, qs.speed
    INTO v_qs
    FROM public.question_sets qs
    WHERE qs.id = NEW.question_set_id;
    NEW.set_time_limit_seconds := v_qs.time_limit_seconds;
    NEW.set_time_limit_at_exam_speed_seconds := v_qs.time_limit_at_exam_speed_seconds;
    NEW.set_speed := v_qs.speed;
  END IF;

  IF NEW.time_taken_seconds IS NOT NULL AND NEW.time_taken_seconds > 0 THEN
    IF NEW.student_set_speed IS NULL AND NEW.set_time_limit_seconds IS NOT NULL AND NEW.set_time_limit_seconds > 0 THEN
      NEW.student_set_speed := NEW.set_time_limit_seconds::NUMERIC / NEW.time_taken_seconds;
    END IF;
    IF NEW.student_exam_speed IS NULL AND NEW.set_time_limit_at_exam_speed_seconds IS NOT NULL AND NEW.set_time_limit_at_exam_speed_seconds > 0 THEN
      NEW.student_exam_speed := NEW.set_time_limit_at_exam_speed_seconds / NEW.time_taken_seconds;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ucat_set_attempt_snapshot_and_speed_trigger ON public.student_question_set_attempts;
CREATE TRIGGER ucat_set_attempt_snapshot_and_speed_trigger
  BEFORE INSERT OR UPDATE OF time_taken_seconds ON public.student_question_set_attempts
  FOR EACH ROW EXECUTE FUNCTION public.ucat_set_attempt_snapshot_and_speed();

-- 5 & 6. Update views: sections (already SELECT * so new columns appear), sets and attempts need explicit new columns

-- vtutor_ucat_sections / vstudent_ucat_sections: they use SELECT us.* so new columns are included. No change.

-- vtutor_ucat_question_sets: add sections, time_limit_at_exam_speed_seconds, speed (and keep stem_count, question_count from 20260226100000)
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
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::int FROM public.question_stems_question_sets qsq WHERE qsq.question_set_id = qs.id) AS stem_count,
  (
    SELECT COUNT(*)::int
    FROM public.ucat_questions q
    INNER JOIN public.question_stems_question_sets qsq ON qsq.question_stem_id = q.question_stem_id AND qsq.question_set_id = qs.id
  ) AS question_count
FROM public.question_sets qs
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;

-- vstudent_ucat_question_sets
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
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

-- vstudent_ucat_my_question_attempts: add student_question_speed
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
  sqa.student_question_speed
FROM public.student_question_attempts sqa
JOIN public.ucat_questions q ON q.id = sqa.question_id
JOIN public.question_stems st ON st.id = q.question_stem_id
JOIN public.ucat_sections us ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao ON qao.id = sqa.question_answer_option_id
WHERE public.is_ucat_student() AND sqa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

-- vtutor_ucat_student_question_attempts: add student_question_speed (same column order as existing, new at end)
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
  sqa.student_question_speed
FROM public.student_question_attempts sqa
JOIN public.students s ON s.id = sqa.student_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqa.student_id);

-- vstudent_ucat_my_set_attempts uses SELECT sqsa.* so new columns appear automatically. No change.

-- vtutor_ucat_student_set_attempts: add set_time_limit_seconds, set_time_limit_at_exam_speed_seconds, set_speed, student_set_speed, student_exam_speed (DROP to add columns)
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
  sqsa.attempted_at,
  sqsa.completed_at
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);

-- vtutor_ucat_student_set_attempt_detail: add the new attempt columns (DROP to add columns)
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
