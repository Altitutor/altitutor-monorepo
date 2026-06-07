-- Per-interval practice-day discount config + credit forfeiture tracking

-- ========================
-- 1) ucat_practice_day_discount_config
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_practice_day_discount_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('week', 'month', 'year')),
  discount_per_day_cents INTEGER NOT NULL CHECK (discount_per_day_cents >= 0),
  max_discounts_per_period INTEGER NOT NULL CHECK (max_discounts_per_period >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (billing_interval)
);

COMMENT ON TABLE public.ucat_practice_day_discount_config IS
  'Practice-day discount amount and cap per billing interval (shared across Unlimited and Pro).';

ALTER TABLE public.ucat_practice_day_discount_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_practice_day_discount_config"
  ON public.ucat_practice_day_discount_config;
CREATE POLICY "ADMINSTAFF full access to ucat_practice_day_discount_config"
  ON public.ucat_practice_day_discount_config
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Authenticated read ucat_practice_day_discount_config"
  ON public.ucat_practice_day_discount_config;
CREATE POLICY "Authenticated read ucat_practice_day_discount_config"
  ON public.ucat_practice_day_discount_config
  FOR SELECT TO authenticated
  USING (true);

-- Seed from legacy global discount_per_day_cents
INSERT INTO public.ucat_practice_day_discount_config (
  billing_interval,
  discount_per_day_cents,
  max_discounts_per_period
)
SELECT 'week', COALESCE(c.discount_per_day_cents, 1000), 7
FROM public.ucat_subscription_config c
ORDER BY c.created_at ASC
LIMIT 1
ON CONFLICT (billing_interval) DO NOTHING;

INSERT INTO public.ucat_practice_day_discount_config (
  billing_interval,
  discount_per_day_cents,
  max_discounts_per_period
)
SELECT 'month', COALESCE(c.discount_per_day_cents, 1000), 30
FROM public.ucat_subscription_config c
ORDER BY c.created_at ASC
LIMIT 1
ON CONFLICT (billing_interval) DO NOTHING;

INSERT INTO public.ucat_practice_day_discount_config (
  billing_interval,
  discount_per_day_cents,
  max_discounts_per_period
)
SELECT 'year', COALESCE(c.discount_per_day_cents, 1000), 365
FROM public.ucat_subscription_config c
ORDER BY c.created_at ASC
LIMIT 1
ON CONFLICT (billing_interval) DO NOTHING;

-- ========================
-- 2) Credit forfeiture column
-- ========================
ALTER TABLE public.student_ucat_practice_day_credits
  ADD COLUMN IF NOT EXISTS forfeited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_ucat_practice_day_credits.forfeited_at IS
  'Set when subscription ends and pending Stripe invoice item is voided.';

CREATE INDEX IF NOT EXISTS idx_student_ucat_practice_day_credits_forfeited
  ON public.student_ucat_practice_day_credits (student_id, forfeited_at)
  WHERE forfeited_at IS NULL;

-- ========================
-- 3) Drop legacy global discount column
-- ========================
ALTER TABLE public.ucat_subscription_config
  DROP COLUMN IF EXISTS discount_per_day_cents;
