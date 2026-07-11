ALTER TABLE public.ucat_plan_prices
  ADD COLUMN checkout_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.ucat_plan_prices.checkout_enabled IS
  'Whether this tier and billing interval is intentionally offered for new checkout.';

CREATE TABLE public.ucat_subscription_journey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'plan_selection_viewed',
    'plan_selected',
    'checkout_loaded',
    'payment_submitted',
    'checkout_completed',
    'checkout_failed',
    'change_plan_clicked',
    'continued_free',
    'quota_upsell_shown',
    'quota_upsell_converted'
  )),
  journey_context TEXT NOT NULL CHECK (journey_context IN (
    'signup_onboarding',
    'subscribe',
    'practice_session',
    'quota_paywall'
  )),
  journey_variant TEXT NOT NULL DEFAULT 'baseline_v1',
  plan_tier TEXT CHECK (plan_tier IN ('unlimited', 'pro')),
  billing_interval TEXT CHECK (billing_interval IN ('week', 'month', 'year')),
  trial_eligible BOOLEAN,
  stripe_checkout_session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ucat_subscription_journey_events_student_created
  ON public.ucat_subscription_journey_events (student_id, created_at DESC);
CREATE INDEX idx_ucat_subscription_journey_events_type_created
  ON public.ucat_subscription_journey_events (event_type, created_at DESC);
CREATE INDEX idx_ucat_subscription_journey_events_checkout_session
  ON public.ucat_subscription_journey_events (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.ucat_subscription_journey_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF read UCAT subscription journey events"
  ON public.ucat_subscription_journey_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

GRANT SELECT ON public.ucat_subscription_journey_events TO authenticated;
GRANT ALL ON public.ucat_subscription_journey_events TO service_role;

COMMENT ON TABLE public.ucat_subscription_journey_events IS
  'First-party funnel events for UCAT plan selection, checkout, and contextual paywalls.';
