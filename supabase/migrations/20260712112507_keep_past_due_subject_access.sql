-- Stripe owns the failed-payment recovery window. A past_due UCAT
-- subscription keeps paid access while Stripe retries, so it must retain the
-- same subject/resource visibility as active and trialing subscriptions.
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
  AND ss.status IN ('trialing', 'active', 'past_due')

UNION

SELECT DISTINCT
  m.student_id,
  m.subject_id,
  'manual'::TEXT AS access_source
FROM public.students_online_access_manual m
WHERE m.student_id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_my_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_my_subject_access IS
  'Per-subject resource access: class enrollment, subscription (trialing/active/past_due), or admin manual access.';
