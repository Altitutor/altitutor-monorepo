-- ========================
-- UCAT Student Views (vstudent_ucat_*)
-- Students can only read if is_ucat_student(). "My" views also filter student_id = current_student_id().
-- Content restricted to is_private = false for stems/sets/mocks.
-- ========================

-- vstudent_ucat_sections
CREATE OR REPLACE VIEW public.vstudent_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_sections TO authenticated;

-- vstudent_ucat_question_stems (list, is_private = false only)
CREATE OR REPLACE VIEW public.vstudent_ucat_question_stems
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
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_stems TO authenticated;

-- vstudent_ucat_question_stem_detail (one stem with questions and answer options, is_private = false)
CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_detail
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
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'answer_options', (
          SELECT json_agg(json_build_object(
            'id', qao.id,
            'answer_text', qao.answer_text,
            'index', qao.index,
            'image_file_id', qao.image_file_id
          ) ORDER BY qao.index)
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id
        )
      ) ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

-- vstudent_ucat_question_sets (list, is_private = false only)
CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.created_at,
  qs.updated_at
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

-- vstudent_ucat_question_set_detail (one set with nested stems, is_private = false)
CREATE OR REPLACE VIEW public.vstudent_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(json_build_object('stem_id', stem_id, 'stem_text', stem_text, 'questions_meta', questions_meta) ORDER BY min_idx)
    FROM (
      SELECT
        st.id AS stem_id,
        st.stem_text,
        MIN(qsq.index) AS min_idx,
        (
          SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index)
          FROM public.ucat_questions q
          JOIN public.questions_sets qsq2 ON qsq2.question_id = q.id AND qsq2.question_set_id = qs.id
          WHERE q.question_stem_id = st.id
        ) AS questions_meta
      FROM public.questions_sets qsq
      JOIN public.ucat_questions q ON q.id = qsq.question_id
      JOIN public.question_stems st ON st.id = q.question_stem_id
      WHERE qsq.question_set_id = qs.id
      GROUP BY st.id, st.stem_text
    ) sub
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false;

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

-- vstudent_ucat_mocks (list, is_private = false only)
CREATE OR REPLACE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;

-- vstudent_ucat_mock_detail (one mock with nested sets, is_private = false)
CREATE OR REPLACE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.is_private = false
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false;

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

-- vstudent_ucat_my_set_attempts (WHERE student_id = current_student_id())
CREATE OR REPLACE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT sqsa.*
FROM public.student_question_set_attempts sqsa
WHERE public.is_ucat_student() AND sqsa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_set_attempts TO authenticated;

-- vstudent_ucat_my_question_attempts (WHERE student_id = current_student_id(), join question, answer options, stem, section names)
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
  sqa.time_spent_seconds
FROM public.student_question_attempts sqa
JOIN public.ucat_questions q ON q.id = sqa.question_id
JOIN public.question_stems st ON st.id = q.question_stem_id
JOIN public.ucat_sections us ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao ON qao.id = sqa.question_answer_option_id
WHERE public.is_ucat_student() AND sqa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

-- vstudent_ucat_my_mock_attempts (WHERE student_id = current_student_id())
CREATE OR REPLACE VIEW public.vstudent_ucat_my_mock_attempts
WITH (security_invoker = false)
AS
SELECT suma.*
FROM public.student_ucat_mock_attempts suma
WHERE public.is_ucat_student() AND suma.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_mock_attempts TO authenticated;

-- vstudent_ucat_my_progress_summary (one row for current student, aggregated stats)
CREATE OR REPLACE VIEW public.vstudent_ucat_my_progress_summary
WITH (security_invoker = false)
AS
SELECT
  public.current_student_id() AS student_id,
  (SELECT COUNT(*)::INT FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = public.current_student_id() AND sqsa.completed_at IS NOT NULL) AS total_sets_attempted,
  (SELECT COUNT(*)::INT FROM public.student_ucat_mock_attempts suma WHERE suma.student_id = public.current_student_id() AND suma.completed_at IS NOT NULL) AS total_mocks_attempted,
  (SELECT AVG(sqsa.score_points) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = public.current_student_id() AND sqsa.completed_at IS NOT NULL) AS avg_score_points,
  (SELECT AVG(sqsa.scaled_score) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = public.current_student_id() AND sqsa.completed_at IS NOT NULL) AS avg_scaled_score,
  (SELECT MAX(sqsa.attempted_at) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = public.current_student_id()) AS last_attempted_at
FROM public.students s
WHERE s.id = public.current_student_id() AND public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_my_progress_summary TO authenticated;
