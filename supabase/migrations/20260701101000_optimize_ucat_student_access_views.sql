CREATE OR REPLACE VIEW public.vstudent_ucat_access_context
WITH (security_invoker = false)
AS
SELECT
  (SELECT public.current_student_id()) AS student_id,
  (SELECT public.is_ucat_online_student()) AS has_online_access,
  (SELECT public.is_ucat_in_person_student()) AS has_in_person_access,
  (
    (SELECT public.is_ucat_online_student())
    OR (SELECT public.is_ucat_in_person_student())
  ) AS has_ucat_access,
  (
    SELECT id
    FROM public.subjects
    WHERE name = 'UCAT'
    LIMIT 1
  ) AS ucat_subject_id;

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_session_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.question_stem_id,
  usr.ucat_learning_module_id
FROM public.vstudent_ucat_access_context ctx
JOIN public.classes_students cs
  ON cs.student_id = ctx.student_id
  AND cs.unenrolled_at IS NULL
JOIN public.classes c
  ON c.id = cs.class_id
  AND c.subject_id = ctx.ucat_subject_id
JOIN public.sessions sess
  ON sess.class_id = c.id
JOIN public.ucat_sessions_resources usr
  ON usr.session_id = sess.id;

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_mocks
WITH (security_invoker = false)
AS
SELECT m.id
FROM public.ucat_mocks m
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE m.deleted_at IS NULL
  AND (
    (ctx.has_online_access AND m.is_private = false)
    OR (
      ctx.has_in_person_access
      AND EXISTS (
        SELECT 1
        FROM public.vstudent_ucat_accessible_session_resources usr
        WHERE usr.ucat_mock_id = m.id
      )
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_sets
WITH (security_invoker = false)
AS
SELECT qs.id
FROM public.question_sets qs
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE qs.deleted_at IS NULL
  AND (
    (ctx.has_online_access AND qs.is_private = false)
    OR (
      ctx.has_in_person_access
      AND (
        EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          WHERE usr.question_set_id = qs.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          JOIN public.question_sets_ucat_mocks qsum
            ON qsum.ucat_mock_id = usr.ucat_mock_id
          WHERE qsum.question_set_id = qs.id
        )
      )
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_stems
WITH (security_invoker = false)
AS
SELECT st.id
FROM public.question_stems st
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE st.deleted_at IS NULL
  AND st.approval_status = 'approved'
  AND (
    (ctx.has_online_access AND st.is_private = false)
    OR (
      ctx.has_in_person_access
      AND (
        EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          WHERE usr.question_stem_id = st.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          JOIN public.question_stems_question_sets qsq
            ON qsq.question_set_id = usr.question_set_id
          WHERE qsq.question_stem_id = st.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.vstudent_ucat_accessible_session_resources usr
          JOIN public.question_sets_ucat_mocks qsum
            ON qsum.ucat_mock_id = usr.ucat_mock_id
          JOIN public.question_stems_question_sets qsq
            ON qsq.question_set_id = qsum.question_set_id
          WHERE qsq.question_stem_id = st.id
        )
      )
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_learning_modules
WITH (security_invoker = false)
AS
SELECT lm.id
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    (ctx.has_online_access AND lm.is_private = false)
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources usr
      WHERE usr.ucat_learning_module_id = lm.id
    )
  );

REVOKE ALL ON
  public.vstudent_ucat_access_context,
  public.vstudent_ucat_accessible_session_resources,
  public.vstudent_ucat_accessible_mocks,
  public.vstudent_ucat_accessible_question_sets,
  public.vstudent_ucat_accessible_question_stems,
  public.vstudent_ucat_accessible_learning_modules
FROM PUBLIC, anon, authenticated;

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
  s.name AS section_name,
  s.section_number,
  p.started_at,
  p.completion_percent,
  p.completed_at
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context ctx
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress p
  ON p.learning_module_id = lm.id
  AND p.student_id = ctx.student_id
LEFT JOIN public.vstudent_ucat_accessible_learning_modules alm
  ON alm.id = lm.id
WHERE lm.deleted_at IS NULL
  AND ctx.has_online_access
  AND (
    lm.kind = 'folder'
    OR alm.id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      JOIN public.vstudent_ucat_accessible_learning_modules accessible_child
        ON accessible_child.id = child.id
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
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
JOIN public.vstudent_ucat_accessible_learning_modules alm
  ON alm.id = b.learning_module_id
JOIN public.ucat_learning_modules lm
  ON lm.id = b.learning_module_id
LEFT JOIN public.ucat_questions q
  ON q.id = b.question_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT student_id FROM public.vstudent_ucat_access_context)
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    b.block_type <> 'question'
    OR (q.id IS NOT NULL AND q.deleted_at IS NULL)
  );

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;

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
JOIN public.vstudent_ucat_accessible_question_stems aqs
  ON aqs.id = qs.id
JOIN public.ucat_sections us
  ON us.id = qs.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stems TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_detail
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
                SELECT count(*)::integer
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id = qao.id
                  AND sqa.is_submitted = true
              ),
              'total_answered', (
                SELECT count(*)::integer
                FROM public.student_question_attempts sqa
                WHERE sqa.question_id = q.id
                  AND sqa.question_answer_option_id IS NOT NULL
                  AND sqa.is_submitted = true
              ),
              'percentage', COALESCE(
                round(
                  (
                    100.0 * (
                      SELECT count(*)::numeric
                      FROM public.student_question_attempts sqa
                      WHERE sqa.question_id = q.id
                        AND sqa.question_answer_option_id = qao.id
                        AND sqa.is_submitted = true
                    )
                  ) / NULLIF(
                    (
                      SELECT count(*)::numeric
                      FROM public.student_question_attempts sqa
                      WHERE sqa.question_id = q.id
                        AND sqa.question_answer_option_id IS NOT NULL
                        AND sqa.is_submitted = true
                    ),
                    0
                  ),
                  1
                ),
                0
              )
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id
            AND qao.deleted_at IS NULL
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id
      AND q.deleted_at IS NULL
  ) AS questions
FROM public.question_stems qs
JOIN public.vstudent_ucat_accessible_question_stems aqs
  ON aqs.id = qs.id
JOIN public.ucat_sections us
  ON us.id = qs.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets
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
JOIN public.vstudent_ucat_accessible_question_sets aqs
  ON aqs.id = qs.id;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

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
        'questions_meta', (
          SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index)
          FROM public.ucat_questions q
          WHERE q.question_stem_id = qsq.question_stem_id
            AND q.deleted_at IS NULL
        )
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st
      ON st.id = qsq.question_stem_id
      AND st.deleted_at IS NULL
    JOIN public.vstudent_ucat_accessible_question_stems ast
      ON ast.id = st.id
    WHERE qsq.question_set_id = qs.id
  ) AS stems
FROM public.question_sets qs
JOIN public.vstudent_ucat_accessible_question_sets aqs
  ON aqs.id = qs.id;

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  m.created_by,
  (
    SELECT count(*)::integer
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS set_count,
  (
    SELECT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks qsum
      JOIN public.vstudent_ucat_accessible_question_sets aqs
        ON aqs.id = qsum.question_set_id
      JOIN public.question_sets qs
        ON qs.id = qsum.question_set_id
        AND qs.deleted_at IS NULL
      WHERE qsum.ucat_mock_id = m.id
        AND qs.time_limit_seconds IS NOT NULL
        AND qs.time_limit_seconds > 0
    )
  ) AS has_timed_sets
FROM public.ucat_mocks m
JOIN public.vstudent_ucat_accessible_mocks am
  ON am.id = m.id;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_mock_detail
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
      )
      ORDER BY qsum.index
    )
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs
      ON qs.id = qsum.question_set_id
      AND qs.deleted_at IS NULL
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = qs.id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
JOIN public.vstudent_ucat_accessible_mocks am
  ON am.id = m.id;

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT
  sqsa.id,
  sqsa.student_id,
  sqsa.question_set_id,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.time_taken_seconds,
  sqsa.student_ucat_mock_attempt_id,
  sqsa.attempted_at,
  sqsa.completed_at,
  sqsa.set_time_limit_seconds,
  sqsa.set_time_limit_at_exam_speed_seconds,
  sqsa.set_speed,
  sqsa.student_set_speed,
  sqsa.student_exam_speed,
  sqsa.was_timed
FROM public.student_question_set_attempts sqsa
JOIN public.vstudent_ucat_access_context ctx
  ON ctx.student_id = sqsa.student_id
  AND ctx.has_ucat_access
JOIN public.vstudent_ucat_accessible_question_sets aqs
  ON aqs.id = sqsa.question_set_id;

GRANT SELECT ON public.vstudent_ucat_my_set_attempts TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_mock_attempts
WITH (security_invoker = false)
AS
SELECT
  suma.id,
  suma.student_id,
  suma.ucat_mock_id,
  suma.attempted_at,
  suma.completed_at,
  suma.score_points,
  suma.total_points,
  suma.scaled_score,
  suma.time_taken,
  suma.mock_time_limit_seconds,
  suma.mock_time_limit_at_exam_speed_seconds,
  suma.student_mock_speed
FROM public.student_ucat_mock_attempts suma
JOIN public.vstudent_ucat_access_context ctx
  ON ctx.student_id = suma.student_id
  AND ctx.has_ucat_access
JOIN public.vstudent_ucat_accessible_mocks am
  ON am.id = suma.ucat_mock_id;

GRANT SELECT ON public.vstudent_ucat_my_mock_attempts TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_attempts
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
JOIN public.vstudent_ucat_access_context ctx
  ON ctx.student_id = sqa.student_id
  AND ctx.has_ucat_access
JOIN public.ucat_questions q
  ON q.id = sqa.question_id
JOIN public.question_stems st
  ON st.id = q.question_stem_id
JOIN public.vstudent_ucat_accessible_question_stems ast
  ON ast.id = st.id
LEFT JOIN public.question_stem_categories qsc
  ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us
  ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao
  ON qao.id = sqa.question_answer_option_id;

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;

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
      )
        THEN 2
      ELSE 1
    END AS max_score
  FROM public.question_stems st
  JOIN public.vstudent_ucat_accessible_question_stems ast
    ON ast.id = st.id
  WHERE EXISTS (
    SELECT 1
    FROM public.ucat_questions q
    WHERE q.question_stem_id = st.id
      AND q.deleted_at IS NULL
  )
)
SELECT
  stem_scores.section_id,
  stem_scores.question_stem_category_id,
  sum(stem_scores.max_score)::integer AS total_questions
FROM stem_scores
GROUP BY stem_scores.section_id, stem_scores.question_stem_category_id;

GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_progress_summary
WITH (security_invoker = false)
AS
SELECT
  ctx.student_id,
  (
    SELECT count(*)::integer
    FROM public.student_question_set_attempts sqsa
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = sqsa.question_set_id
    WHERE sqsa.student_id = ctx.student_id
      AND sqsa.completed_at IS NOT NULL
  ) AS total_sets_attempted,
  (
    SELECT count(*)::integer
    FROM public.student_ucat_mock_attempts suma
    JOIN public.vstudent_ucat_accessible_mocks am
      ON am.id = suma.ucat_mock_id
    WHERE suma.student_id = ctx.student_id
      AND suma.completed_at IS NOT NULL
  ) AS total_mocks_attempted,
  (
    SELECT avg(sqsa.score_points)
    FROM public.student_question_set_attempts sqsa
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = sqsa.question_set_id
    WHERE sqsa.student_id = ctx.student_id
      AND sqsa.completed_at IS NOT NULL
  ) AS avg_score_points,
  (
    SELECT avg(sqsa.scaled_score)
    FROM public.student_question_set_attempts sqsa
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = sqsa.question_set_id
    WHERE sqsa.student_id = ctx.student_id
      AND sqsa.completed_at IS NOT NULL
  ) AS avg_scaled_score,
  (
    SELECT max(sqsa.attempted_at)
    FROM public.student_question_set_attempts sqsa
    JOIN public.vstudent_ucat_accessible_question_sets aqs
      ON aqs.id = sqsa.question_set_id
    WHERE sqsa.student_id = ctx.student_id
  ) AS last_attempted_at
FROM public.vstudent_ucat_access_context ctx
WHERE ctx.student_id IS NOT NULL
  AND ctx.has_ucat_access;

GRANT SELECT ON public.vstudent_ucat_my_progress_summary TO authenticated;
