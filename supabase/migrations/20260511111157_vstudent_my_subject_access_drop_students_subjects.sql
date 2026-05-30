-- Resource access: stop treating students_subjects as a grant path.
-- vstudent_subjects is unchanged (still includes students_subjects for listing / other UX).

CREATE OR REPLACE VIEW public.vstudent_my_subject_access
WITH (security_invoker = false)
AS
SELECT DISTINCT
  cs.student_id,
  c.subject_id,
  'class_enrollment'::TEXT AS access_source
FROM public.classes_students cs
JOIN public.classes c ON c.id = cs.class_id
WHERE cs.student_id = (SELECT public.current_student_id())
  AND cs.unenrolled_at IS NULL

UNION

SELECT DISTINCT
  ss.student_id,
  ss.subject_id,
  'subscription'::TEXT AS access_source
FROM public.student_subscriptions ss
WHERE ss.student_id = (SELECT public.current_student_id())
  AND ss.status IN ('trialing', 'active')

UNION

SELECT DISTINCT
  m.student_id,
  m.subject_id,
  'manual'::TEXT AS access_source
FROM public.students_online_access_manual m
WHERE m.student_id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_my_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_my_subject_access IS 'Per-subject resource access: class_enrollment, subscription (trialing/active), or admin manual (students_online_access_manual only).';
