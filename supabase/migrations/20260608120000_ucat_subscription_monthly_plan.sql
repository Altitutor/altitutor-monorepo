-- Monthly Pro plan fields on ucat_subscription_config (admin-configurable; no hardcoded Stripe IDs in app code)

ALTER TABLE public.ucat_subscription_config
  ADD COLUMN IF NOT EXISTS monthly_base_price_cents INTEGER NOT NULL DEFAULT 22500,
  ADD COLUMN IF NOT EXISTS monthly_stripe_price_id TEXT;

COMMENT ON COLUMN public.ucat_subscription_config.monthly_base_price_cents IS
  'Displayed monthly UCAT Pro price on subscribe page (minor units / cents).';
COMMENT ON COLUMN public.ucat_subscription_config.monthly_stripe_price_id IS
  'Stripe price ID for monthly UCAT Pro checkout.';

-- Derive monthly display price from weekly base for existing rows
UPDATE public.ucat_subscription_config
SET monthly_base_price_cents = GREATEST(0, ROUND(base_price_cents * 4 * 0.75));
