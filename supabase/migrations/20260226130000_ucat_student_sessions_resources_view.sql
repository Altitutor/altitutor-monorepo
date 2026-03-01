-- ========================
-- UCAT: Student view for session resources
-- vstudent_ucat_sessions_resources
-- Mirrors vtutor_ucat_sessions_resources but scoped to:
--  - Current student only (sessions they are in)
--  - UCAT subject via is_ucat_student() helper
-- ========================

CREATE OR REPLACE VIEW public.vstudent_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.index,
  usr.created_by,
  usr.created_at
FROM public.ucat_sessions_resources usr
JOIN public.sessions s ON s.id = usr.session_id
JOIN public.classes c ON c.id = s.class_id
JOIN public.classes_students cs ON cs.class_id = c.id
WHERE
  public.is_ucat_student()
  AND cs.student_id = public.current_student_id()
  AND cs.unenrolled_at IS NULL
  AND c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1);

GRANT SELECT ON public.vstudent_ucat_sessions_resources TO authenticated;

