-- Resolve portal routing decisions in one caller-scoped database round trip.
-- These functions intentionally answer access/routing questions only. Product
-- onboarding personalisation remains a separate concern.

CREATE OR REPLACE FUNCTION public.current_student_portal_access()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'student_id', student_record.id,
    'active_staff_role', active_staff.role
  )
  FROM (SELECT (SELECT auth.uid()) AS user_id) AS caller
  LEFT JOIN LATERAL (
    SELECT student.id
    FROM public.students AS student
    WHERE student.user_id = caller.user_id
    LIMIT 1
  ) AS student_record ON TRUE
  LEFT JOIN LATERAL (
    SELECT staff.role::TEXT AS role
    FROM public.staff AS staff
    WHERE staff.user_id = caller.user_id
      AND staff.role IN ('ADMINSTAFF', 'TUTOR')
      AND staff.status = 'ACTIVE'
    LIMIT 1
  ) AS active_staff ON TRUE
  WHERE caller.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_student_portal_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_student_portal_access()
  TO authenticated;

COMMENT ON FUNCTION public.current_student_portal_access() IS
  'Caller-scoped StudentWeb routing decision. Student identity grants portal entry; onboarding personalisation is deliberately outside this contract.';

CREATE OR REPLACE FUNCTION public.current_ucat_portal_access()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'student_id', (SELECT public.current_student_id()),
    'has_online_access', access_record.has_online_access,
    'has_in_person_access', access_record.has_in_person_access,
    'has_ucat_access', access_record.has_ucat_access,
    'online_tier', access_record.online_tier,
    'is_quota_exempt', access_record.is_quota_exempt,
    'ucat_onboarding_completed_at', access_record.ucat_onboarding_completed_at,
    'unlimited_trial_eligible', access_record.unlimited_trial_eligible,
    'ucat_signup_step', access_record.ucat_signup_step,
    'ucat_signup_completed_at', access_record.ucat_signup_completed_at,
    'ucat_analytics_account_class', access_record.ucat_analytics_account_class,
    'ucat_test_year', access_record.ucat_test_year,
    'ucat_test_date', access_record.ucat_test_date,
    'active_staff_role', public.current_ucat_signup_staff_role()
  )
  FROM (SELECT (SELECT auth.uid()) AS user_id) AS caller
  LEFT JOIN LATERAL (
    SELECT access.*
    FROM public.vstudent_ucat_my_access AS access
    LIMIT 1
  ) AS access_record ON TRUE
  WHERE caller.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_ucat_portal_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_ucat_portal_access()
  TO authenticated;

COMMENT ON FUNCTION public.current_ucat_portal_access() IS
  'Caller-scoped UCAT Web access, signup progress, entitlement summary, and active staff routing decision in one round trip.';
