-- ========================
-- UCAT Tutor Views (vtutor_ucat_*)
-- Tutors can only read if is_ucat_tutor(). security_invoker = false (run as definer).
-- ========================

-- vtutor_ucat_sections
CREATE OR REPLACE VIEW public.vtutor_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_sections TO authenticated;

-- vtutor_ucat_question_stems (list: stem id, section info, category info, is_private, created/updated by, question_count)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns AS section_display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  (SELECT COUNT(*)::INT FROM public.ucat_questions q WHERE q.question_stem_id = qs.id) AS question_count
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;

-- vtutor_ucat_question_stem_detail (one row per stem, questions as JSONB with answer_options)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'tags', (SELECT json_agg(json_build_object('id', qt.id, 'name', qt.name)) FROM public.questions_question_tags qqt JOIN public.question_tags qt ON qt.id = qqt.tag_id WHERE qqt.question_id = q.id),
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'image_file_id', qao.image_file_id
            ) ORDER BY qao.index
          )
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
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;

-- vtutor_ucat_question_sets (list)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
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

-- vtutor_ucat_question_set_detail (one row per set, stems JSONB ordered by min question index in set)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
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
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;

-- vtutor_ucat_mocks (list)
CREATE OR REPLACE VIEW public.vtutor_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;

-- vtutor_ucat_mock_detail (one row per mock, sets JSONB ordered by index)
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
    SELECT json_agg(json_build_object('id', qs.id, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;

-- vtutor_ucat_question_stem_categories (flat)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_stem_categories
WITH (security_invoker = false)
AS
SELECT qsc.*
FROM public.question_stem_categories qsc
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_categories TO authenticated;

-- vtutor_ucat_question_tags (flat)
CREATE OR REPLACE VIEW public.vtutor_ucat_question_tags
WITH (security_invoker = false)
AS
SELECT qt.*
FROM public.question_tags qt
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_tags TO authenticated;

-- vtutor_ucat_question_sets_sessions
CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets_sessions
WITH (security_invoker = false)
AS
SELECT qss.*
FROM public.question_sets_sessions qss
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets_sessions TO authenticated;

-- vtutor_ucat_mocks_sessions
CREATE OR REPLACE VIEW public.vtutor_ucat_mocks_sessions
WITH (security_invoker = false)
AS
SELECT ms.*
FROM public.mocks_sessions ms
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks_sessions TO authenticated;

-- vtutor_ucat_student_question_attempts (tutors see all students)
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
  sqa.time_spent_seconds
FROM public.student_question_attempts sqa
JOIN public.students s ON s.id = sqa.student_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_question_attempts TO authenticated;

-- vtutor_ucat_student_set_attempts (list: attempt_id, student_id, student_name, set_id, set_name, score_points, total_points, scaled_score, attempted_at, completed_at)
CREATE OR REPLACE VIEW public.vtutor_ucat_student_set_attempts
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
  sqsa.attempted_at,
  sqsa.completed_at
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_set_attempts TO authenticated;

-- vtutor_ucat_student_set_attempt_detail (one row per set attempt, questions JSONB)
CREATE OR REPLACE VIEW public.vtutor_ucat_student_set_attempt_detail
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
        'was_correct', (sqa.score > 0),
        'student_answer_snapshot', sqa.answer_snapshot,
        'correct_answer_summary', (SELECT json_build_object('correct_option_id', (SELECT qao.id FROM public.question_answer_options qao WHERE qao.question_id = q.id AND qao.is_answer LIMIT 1)))
      ) ORDER BY q.index
    )
    FROM public.student_question_attempts sqa
    JOIN public.ucat_questions q ON q.id = sqa.question_id
    WHERE sqa.student_question_set_attempt_id = sqsa.id AND sqa.is_submitted
  ) AS questions
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_set_attempt_detail TO authenticated;

-- vtutor_ucat_student_mock_attempts (list, with student name)
CREATE OR REPLACE VIEW public.vtutor_ucat_student_mock_attempts
WITH (security_invoker = false)
AS
SELECT
  suma.id,
  suma.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  suma.ucat_mock_id,
  m.name AS mock_name,
  suma.attempted_at,
  suma.completed_at
FROM public.student_ucat_mock_attempts suma
JOIN public.students s ON s.id = suma.student_id
JOIN public.ucat_mocks m ON m.id = suma.ucat_mock_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_mock_attempts TO authenticated;

-- vtutor_ucat_student_mock_attempt_detail (one row per mock attempt, set_attempts JSONB)
CREATE OR REPLACE VIEW public.vtutor_ucat_student_mock_attempt_detail
WITH (security_invoker = false)
AS
SELECT
  suma.id,
  suma.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  suma.ucat_mock_id,
  m.name AS mock_name,
  suma.attempted_at,
  suma.completed_at,
  (
    SELECT json_agg(json_build_object(
      'attempt_id', sqsa.id,
      'question_set_id', sqsa.question_set_id,
      'score_points', sqsa.score_points,
      'total_points', sqsa.total_points,
      'scaled_score', sqsa.scaled_score,
      'attempted_at', sqsa.attempted_at,
      'completed_at', sqsa.completed_at
    ) ORDER BY sqsa.attempted_at)
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_ucat_mock_attempt_id = suma.id
  ) AS set_attempts
FROM public.student_ucat_mock_attempts suma
JOIN public.students s ON s.id = suma.student_id
JOIN public.ucat_mocks m ON m.id = suma.ucat_mock_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_mock_attempt_detail TO authenticated;

-- vtutor_ucat_student_progress_summary (one row per student: totals and per-section aggregates)
CREATE OR REPLACE VIEW public.vtutor_ucat_student_progress_summary
WITH (security_invoker = false)
AS
SELECT
  st.id AS student_id,
  st.first_name || ' ' || st.last_name AS student_name,
  (SELECT COUNT(*)::INT FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = st.id AND sqsa.completed_at IS NOT NULL) AS total_sets_attempted,
  (SELECT COUNT(*)::INT FROM public.student_ucat_mock_attempts suma WHERE suma.student_id = st.id AND suma.completed_at IS NOT NULL) AS total_mocks_attempted,
  (SELECT AVG(sqsa.score_points) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = st.id AND sqsa.completed_at IS NOT NULL) AS avg_score_points,
  (SELECT AVG(sqsa.scaled_score) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = st.id AND sqsa.completed_at IS NOT NULL) AS avg_scaled_score,
  (SELECT MAX(sqsa.attempted_at) FROM public.student_question_set_attempts sqsa WHERE sqsa.student_id = st.id) AS last_attempted_at
FROM public.students st
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_student_progress_summary TO authenticated;
