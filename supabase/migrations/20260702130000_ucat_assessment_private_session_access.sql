-- Align private access for mocks, sets, and stems with learning modules:
-- private content is visible to any enrolled student assigned via a class session,
-- not only in-person students.

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_mocks
WITH (security_invoker = false)
AS
SELECT m.id
FROM public.ucat_mocks m
CROSS JOIN public.vstudent_ucat_access_context ctx
WHERE m.deleted_at IS NULL
  AND (
    (ctx.has_online_access AND m.is_private = false)
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources usr
      WHERE usr.ucat_mock_id = m.id
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
    OR EXISTS (
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
    OR EXISTS (
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
