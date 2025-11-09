-- Migration: Stripe Webhook Events Audit Log
-- Description: Creates table to log all Stripe webhook events for debugging and idempotency

-- ================================================
-- CREATE STRIPE_WEBHOOK_EVENTS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.stripe_webhook_events(created_at DESC);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "ADMINSTAFF full access to webhook_events" ON public.stripe_webhook_events
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.stripe_webhook_events IS 'Audit log of all Stripe webhook events for debugging and idempotency';
COMMENT ON COLUMN public.stripe_webhook_events.stripe_event_id IS 'Unique Stripe event ID (evt_xxx) for idempotency';
COMMENT ON COLUMN public.stripe_webhook_events.event_type IS 'Stripe event type (e.g., payment_intent.succeeded)';
COMMENT ON COLUMN public.stripe_webhook_events.event_data IS 'Full Stripe event payload as JSON';
COMMENT ON COLUMN public.stripe_webhook_events.processed IS 'Whether this event has been successfully processed';
COMMENT ON COLUMN public.stripe_webhook_events.error_message IS 'Error message if processing failed';

