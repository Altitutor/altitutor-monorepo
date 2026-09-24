-- UCAT tutors need a cohort-wide reporting surface: online Free, Unlimited,
-- Pro, and active in-person UCAT students. Keep this predicate centralized so
-- all existing vtutor_ucat_* detail views enforce the same population scope.
CREATE OR REPLACE FUNCTION public.can_current_tutor_view_ucat_student(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_ucat_tutor()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = p_student_id
        AND s.user_id IS NOT NULL
        AND (
          s.ucat_signup_completed_at IS NOT NULL
          OR s.ucat_onboarding_completed_at IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM public.classes_students cs
            JOIN public.classes c ON c.id = cs.class_id
            JOIN public.subjects subject ON subject.id = c.subject_id
            WHERE cs.student_id = s.id
              AND cs.unenrolled_at IS NULL
              AND subject.name = 'UCAT'
          )
          OR EXISTS (
            SELECT 1
            FROM public.student_subscriptions subscription
            JOIN public.subjects subject
              ON subject.id = subscription.subject_id
            WHERE subscription.student_id = s.id
              AND subject.name = 'UCAT'
              AND subscription.status IN ('trialing', 'active', 'past_due')
          )
          OR EXISTS (
            SELECT 1
            FROM public.student_question_attempts attempt
            WHERE attempt.student_id = s.id
              AND attempt.is_submitted = true
          )
          OR EXISTS (
            SELECT 1
            FROM public.student_question_set_attempts attempt
            WHERE attempt.student_id = s.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.student_ucat_mock_attempts attempt
            WHERE attempt.student_id = s.id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_current_tutor_view_ucat_student(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_current_tutor_view_ucat_student(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_current_tutor_view_ucat_student(uuid) IS
  'Allows UCAT tutors to report on all UCAT-web users and active in-person UCAT students with a linked login.';
