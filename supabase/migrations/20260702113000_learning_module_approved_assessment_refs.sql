-- Learning modules may reference approved private UCAT assessment content without
-- making that content generally visible. Pending/rejected/deleted content must
-- not appear in student-visible lessons.

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
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks b
      JOIN public.vstudent_ucat_accessible_learning_modules alm
        ON alm.id = b.learning_module_id
      WHERE b.deleted_at IS NULL
        AND b.block_type = 'question_stem'
        AND b.question_stem_id = st.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks b
      JOIN public.vstudent_ucat_accessible_learning_modules alm
        ON alm.id = b.learning_module_id
      JOIN public.ucat_questions q
        ON q.id = b.question_id
      WHERE b.deleted_at IS NULL
        AND b.block_type = 'question'
        AND q.deleted_at IS NULL
        AND q.question_stem_id = st.id
    )
  );

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
  b.skill_trainer_id,
  bp.completed_at AS block_completed_at,
  bp.manually_completed,
  bp.interaction_state
FROM public.ucat_learning_module_blocks b
JOIN public.vstudent_ucat_accessible_learning_modules alm
  ON alm.id = b.learning_module_id
JOIN public.ucat_learning_modules lm
  ON lm.id = b.learning_module_id
LEFT JOIN public.question_stems qs
  ON qs.id = b.question_stem_id
LEFT JOIN public.ucat_questions q
  ON q.id = b.question_id
LEFT JOIN public.question_stems q_stem
  ON q_stem.id = q.question_stem_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT student_id FROM public.vstudent_ucat_access_context)
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    b.block_type <> 'question_stem'
    OR (
      qs.id IS NOT NULL
      AND qs.deleted_at IS NULL
      AND qs.approval_status = 'approved'
    )
  )
  AND (
    b.block_type <> 'question'
    OR (
      q.id IS NOT NULL
      AND q.deleted_at IS NULL
      AND q_stem.id IS NOT NULL
      AND q_stem.deleted_at IS NULL
      AND q_stem.approval_status = 'approved'
    )
  );

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;
