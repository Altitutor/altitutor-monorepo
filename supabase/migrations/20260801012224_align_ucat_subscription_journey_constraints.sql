ALTER TABLE public.ucat_subscription_journey_events
  DROP CONSTRAINT IF EXISTS ucat_subscription_journey_events_event_type_check,
  ADD CONSTRAINT ucat_subscription_journey_events_event_type_check
  CHECK (event_type IN (
    'plan_selection_viewed',
    'plan_selected',
    'checkout_loaded',
    'payment_submitted',
    'checkout_completed',
    'checkout_failed',
    'change_plan_clicked',
    'continued_free',
    'free_plan_selected',
    'cancellation_dialog_opened',
    'cancellation_abandoned',
    'cancellation_confirmed',
    'cancellation_accelerated',
    'cancellation_reversed',
    'quota_upsell_shown',
    'quota_upsell_converted'
  ));

ALTER TABLE public.ucat_subscription_journey_events
  DROP CONSTRAINT IF EXISTS ucat_subscription_journey_events_journey_context_check,
  ADD CONSTRAINT ucat_subscription_journey_events_journey_context_check
  CHECK (journey_context IN (
    'signup_onboarding',
    'subscribe',
    'practice_session',
    'referral_gift',
    'quota_paywall',
    'subscription_settings'
  ));
