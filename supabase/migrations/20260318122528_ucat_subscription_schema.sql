-- UCAT Subscription Access - Schema and access logic
-- Access via: (1) UCAT class enrollment OR (2) active subscription (trialing/active)
-- Removes manual assignment path (students_subjects for UCAT)

-- ========================
-- 1. Add timezone to students
-- ========================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Australia/Adelaide';

COMMENT ON COLUMN public.students.timezone IS 'IANA timezone for per-day boundaries (e.g. practice day credits). Default Australia/Adelaide.';

-- ========================
-- 2. ucat_subscription_config (singleton config)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_subscription_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_questions_per_day INTEGER NOT NULL DEFAULT 20,
  discount_per_day_cents INTEGER NOT NULL DEFAULT 1000,
  billing_interval TEXT NOT NULL DEFAULT 'week' CHECK (billing_interval IN ('week', 'fortnight', 'month')),
  trial_days INTEGER NOT NULL DEFAULT 7,
  base_price_cents INTEGER NOT NULL DEFAULT 7500,
  currency TEXT NOT NULL DEFAULT 'aud',
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ucat_subscription_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_subscription_config" ON public.ucat_subscription_config;
CREATE POLICY "ADMINSTAFF full access to ucat_subscription_config" ON public.ucat_subscription_config
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Allow authenticated read for config (needed by checkout API)
DROP POLICY IF EXISTS "Authenticated read ucat_subscription_config" ON public.ucat_subscription_config;
CREATE POLICY "Authenticated read ucat_subscription_config" ON public.ucat_subscription_config
  FOR SELECT TO authenticated
  USING (true);

-- ========================
-- 3. student_ucat_subscriptions
-- ========================
CREATE TABLE IF NOT EXISTS public.student_ucat_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_ucat_subscriptions_student_unique UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_ucat_subscriptions_student_id ON public.student_ucat_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_ucat_subscriptions_stripe_subscription_id ON public.student_ucat_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_student_ucat_subscriptions_status ON public.student_ucat_subscriptions(status);

ALTER TABLE public.student_ucat_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to student_ucat_subscriptions" ON public.student_ucat_subscriptions;
CREATE POLICY "ADMINSTAFF full access to student_ucat_subscriptions" ON public.student_ucat_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Students can read their own subscription
DROP POLICY IF EXISTS "Students read own student_ucat_subscriptions" ON public.student_ucat_subscriptions;
CREATE POLICY "Students read own student_ucat_subscriptions" ON public.student_ucat_subscriptions
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- ========================
-- 4. student_ucat_practice_day_credits
-- ========================
CREATE TABLE IF NOT EXISTS public.student_ucat_practice_day_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  credit_date DATE NOT NULL,
  stripe_invoice_item_id TEXT NOT NULL,
  discount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_ucat_practice_day_credits_unique UNIQUE (student_id, credit_date)
);

CREATE INDEX IF NOT EXISTS idx_student_ucat_practice_day_credits_student_id ON public.student_ucat_practice_day_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_student_ucat_practice_day_credits_credit_date ON public.student_ucat_practice_day_credits(credit_date);

ALTER TABLE public.student_ucat_practice_day_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to student_ucat_practice_day_credits" ON public.student_ucat_practice_day_credits;
CREATE POLICY "ADMINSTAFF full access to student_ucat_practice_day_credits" ON public.student_ucat_practice_day_credits
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Service role / API will insert (no student write policy - done via API with admin client)

-- ========================
-- 5. Update is_ucat_student()
-- ========================
-- Now checks: (1) UCAT class enrollment OR (2) active subscription (trialing/active)
-- Removes students_subjects (manual assignment) path
CREATE OR REPLACE FUNCTION public.is_ucat_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    -- Path 1: Enrolled in UCAT class
    SELECT 1
    FROM public.classes c
    JOIN public.classes_students cs ON c.id = cs.class_id
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cs.student_id = public.current_student_id()
      AND cs.unenrolled_at IS NULL
  )
  OR EXISTS (
    -- Path 2: Active subscription (trialing or active, not past_due/unpaid/canceled)
    SELECT 1
    FROM public.student_ucat_subscriptions s
    WHERE s.student_id = public.current_student_id()
      AND s.status IN ('trialing', 'active')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_student() TO authenticated;
COMMENT ON FUNCTION public.is_ucat_student() IS 'Returns true if the current student has UCAT access via class enrollment OR active subscription (trialing/active). Use in vstudent_ucat_* views.';

-- ========================
-- 6. Seed ucat_subscription_config (only if empty)
-- ========================
INSERT INTO public.ucat_subscription_config (
  min_questions_per_day,
  discount_per_day_cents,
  billing_interval,
  trial_days,
  base_price_cents,
  currency
)
SELECT 20, 1000, 'week', 7, 7500, 'aud'
WHERE NOT EXISTS (SELECT 1 FROM public.ucat_subscription_config LIMIT 1);
