-- Restore the caller-scoped read facades that lost access when
-- 20260721082329 removed student/tutor base-table policies.
--
-- These views enforce their own current-student/current-tutor predicates, so
-- they must execute with the view owner's privileges while authenticated
-- students and tutors remain unable to read the base tables directly.

ALTER VIEW public.vstudent_subscriptions
  SET (security_invoker = false);

ALTER VIEW public.vstudent_notifications
  SET (security_invoker = false);

ALTER VIEW public.vucat_notifications
  SET (security_invoker = false);

ALTER VIEW public.vtutor_notifications
  SET (security_invoker = false);

COMMENT ON VIEW public.vstudent_subscriptions IS
  'Student facade: own subscriptions including safe billing recovery and cancellation state.';

COMMENT ON VIEW public.vstudent_notifications IS
  'Student facade: current student notifications scoped to Student Web.';

COMMENT ON VIEW public.vucat_notifications IS
  'Student facade: current student notifications scoped to Altitutor UCAT.';

COMMENT ON VIEW public.vtutor_notifications IS
  'Tutor facade: current tutor notifications scoped to staff-facing apps.';
