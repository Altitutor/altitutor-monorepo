-- Restore vstudent_subjects as the student's linked-subject listing view.
--
-- Intended split:
--   - vstudent_subjects: subjects linked to the student (students_subjects,
--     class enrollment, subscription, manual) for UX / listing
--   - vstudent_my_subject_access: resource access only (class enrollment,
--     subscription, manual) — does NOT include students_subjects
--
-- 20260625090416 incorrectly collapsed vstudent_subjects onto access only.
-- Resource topic/file/image views remain scoped by vstudent_my_subject_access.

CREATE OR REPLACE VIEW public.vstudent_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.short_name,
  sub.long_name,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  -- Registration / admin-linked subjects (enrollment intent, not resource access)
  SELECT ss.subject_id
  FROM public.students_subjects ss
  WHERE ss.student_id = (SELECT public.current_student_id())

  UNION

  -- Subjects with actual resource access
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subjects IS
  'Student linked subjects for listing/UX: students_subjects plus subjects from vstudent_my_subject_access. Resource content remains gated by vstudent_my_subject_access.';
