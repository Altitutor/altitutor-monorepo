-- UCAT freemium: UCAT Free (default, per-area quotas) + UCAT Pro (unlimited)
-- See docs/adr/0002-ucat-freemium-access.md

-- ========================
-- 1) Student tier / onboarding columns
-- ========================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS ucat_online_tier_override TEXT NOT NULL DEFAULT 'default'
    CHECK (ucat_online_tier_override IN ('default', 'force_free', 'force_pro')),
  ADD COLUMN IF NOT EXISTS ucat_onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ucat_pro_trial_consumed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.students.ucat_online_tier_override IS 'Admin override for UCAT online tier: default (Stripe-derived), force_free, force_pro.';
COMMENT ON COLUMN public.students.ucat_onboarding_completed_at IS 'When the student completed the required UCAT onboarding choice (Free vs Pro trial).';
COMMENT ON COLUMN public.students.ucat_pro_trial_consumed_at IS 'Set when a Pro trial subscription (trialing) is first created; prevents second trial.';

-- Migrate existing manual UCAT grants to force_pro
UPDATE public.students s
SET ucat_online_tier_override = 'force_pro'
FROM public.students_online_access_manual m
JOIN public.subjects sub ON sub.id = m.subject_id AND sub.name = 'UCAT'
WHERE m.student_id = s.id
  AND s.ucat_online_tier_override = 'default';

-- Mark existing students as onboarding-complete (pre-launch testing data)
UPDATE public.students
SET ucat_onboarding_completed_at = COALESCE(ucat_onboarding_completed_at, NOW())
WHERE ucat_onboarding_completed_at IS NULL;

-- ========================
-- 2) UCAT Free quota config (per area)
-- ========================
ALTER TABLE public.ucat_subscription_config
  ADD COLUMN IF NOT EXISTS free_practice_limit INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS free_practice_period TEXT NOT NULL DEFAULT 'day'
    CHECK (free_practice_period IN ('day', 'week', 'month')),
  ADD COLUMN IF NOT EXISTS free_sets_limit INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS free_sets_period TEXT NOT NULL DEFAULT 'week'
    CHECK (free_sets_period IN ('day', 'week', 'month')),
  ADD COLUMN IF NOT EXISTS free_mocks_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS free_mocks_period TEXT NOT NULL DEFAULT 'month'
    CHECK (free_mocks_period IN ('day', 'week', 'month')),
  ADD COLUMN IF NOT EXISTS free_learn_limit INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS free_learn_period TEXT NOT NULL DEFAULT 'week'
    CHECK (free_learn_period IN ('day', 'week', 'month')),
  ADD COLUMN IF NOT EXISTS free_skill_trainer_limit INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS free_skill_trainer_period TEXT NOT NULL DEFAULT 'week'
    CHECK (free_skill_trainer_period IN ('day', 'week', 'month'));

COMMENT ON COLUMN public.ucat_subscription_config.free_practice_limit IS 'UCAT Free: unique practice questions submitted per period. 0 = disabled.';
COMMENT ON COLUMN public.ucat_subscription_config.free_sets_limit IS 'UCAT Free: standalone set attempts started per period. 0 = disabled.';
COMMENT ON COLUMN public.ucat_subscription_config.free_mocks_limit IS 'UCAT Free: mock attempts started per period. 0 = disabled.';
COMMENT ON COLUMN public.ucat_subscription_config.free_learn_limit IS 'UCAT Free: learning modules started per period. 0 = disabled.';
COMMENT ON COLUMN public.ucat_subscription_config.free_skill_trainer_limit IS 'UCAT Free: skill trainer sessions started per period. 0 = disabled.';

-- ========================
-- 3) Tier helpers
-- ========================
CREATE OR REPLACE FUNCTION public.get_ucat_subject_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.student_has_ucat_pro_subscription(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    WHERE ss.student_id = p_student_id
      AND ss.subject_id = public.get_ucat_subject_id()
      AND ss.status IN ('trialing', 'active')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_pro' THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'trialing'
    ) THEN 'pro_trial'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'active'
    ) THEN 'pro'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id;
$$;

CREATE OR REPLACE FUNCTION public.is_ucat_online_quota_exempt(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_student_ucat_online_tier(p_student_id) IN ('pro', 'pro_trial');
$$;

-- Any signed-up student with a profile may use online product areas (at least UCAT Free).
CREATE OR REPLACE FUNCTION public.is_ucat_online_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (SELECT public.current_student_id()) IS NOT NULL;
$$;

COMMENT ON FUNCTION public.is_ucat_online_student() IS 'UCAT online product access: any authenticated student profile (UCAT Free or Pro). Gates public catalog reads.';

CREATE OR REPLACE FUNCTION public.is_ucat_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_ucat_in_person_student() OR public.is_ucat_online_student();
$$;

-- ========================
-- 4) Quota period boundaries (student timezone)
-- ========================
CREATE OR REPLACE FUNCTION public.ucat_quota_period_start(
  p_period TEXT,
  p_timezone TEXT,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  local_ts TIMESTAMP;
  local_date DATE;
BEGIN
  local_ts := p_at AT TIME ZONE p_timezone;
  local_date := local_ts::DATE;

  IF p_period = 'day' THEN
    RETURN (local_date::TIMESTAMP AT TIME ZONE p_timezone);
  ELSIF p_period = 'week' THEN
    -- ISO week: Monday start
    RETURN ((local_date - ((EXTRACT(ISODOW FROM local_date)::INT) - 1))::TIMESTAMP AT TIME ZONE p_timezone);
  ELSIF p_period = 'month' THEN
    RETURN (DATE_TRUNC('month', local_date)::TIMESTAMP AT TIME ZONE p_timezone);
  END IF;

  RAISE EXCEPTION 'Invalid quota period: %', p_period;
END;
$$;

-- ========================
-- 5) Pro trial consumed trigger
-- ========================
CREATE OR REPLACE FUNCTION public.mark_ucat_pro_trial_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'trialing'
     AND NEW.subject_id = public.get_ucat_subject_id()
     AND TG_OP = 'INSERT' THEN
    UPDATE public.students
    SET ucat_pro_trial_consumed_at = COALESCE(ucat_pro_trial_consumed_at, NOW())
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_ucat_pro_trial_consumed ON public.student_subscriptions;
CREATE TRIGGER trg_mark_ucat_pro_trial_consumed
  AFTER INSERT ON public.student_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_ucat_pro_trial_consumed();

-- ========================
-- 6) vstudent_ucat_my_access — extended tier fields
-- ========================
CREATE OR REPLACE VIEW public.vstudent_ucat_my_access
WITH (security_invoker = false)
AS
SELECT
  public.is_ucat_online_student() AS has_online_access,
  public.is_ucat_in_person_student() AS has_in_person_access,
  public.is_ucat_student() AS has_ucat_access,
  public.get_student_ucat_online_tier((SELECT public.current_student_id())) AS online_tier,
  public.is_ucat_online_quota_exempt((SELECT public.current_student_id())) AS is_quota_exempt,
  (
    SELECT s.ucat_onboarding_completed_at
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS ucat_onboarding_completed_at,
  (
    SELECT s.ucat_pro_trial_consumed_at IS NULL
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS pro_trial_eligible
WHERE (SELECT public.current_student_id()) IS NOT NULL;

GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_access IS 'UCAT entitlements: in-person add-on, online tier (free/pro_trial/pro), quota exemption, onboarding and trial eligibility.';
