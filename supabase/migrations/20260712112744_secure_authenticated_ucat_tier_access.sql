-- vstudent_ucat_my_access resolves the current student's tier through this
-- helper. Keep the service-role reconciliation use case, while allowing an
-- authenticated caller to resolve only the student row owned by auth.uid().
CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN s.ucat_online_tier_override = 'force_pro' THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'trialing'
    ) THEN 'unlimited_trial'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status IN ('active', 'past_due')
        AND ss.plan_tier = 'pro'
    ) THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status IN ('active', 'past_due')
    ) THEN 'unlimited'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id
    AND (
      (SELECT auth.uid()) IS NULL
      OR s.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_student_ucat_online_tier(uuid) IS
  'Resolves UCAT access. Authenticated callers may resolve only their own student; service role may reconcile any student. past_due retains paid access.';
