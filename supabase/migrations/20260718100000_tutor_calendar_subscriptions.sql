-- One opaque calendar-subscription token per tutor. Calendar clients cannot use
-- Supabase Auth, so the token is the bearer credential for the read-only feed.
CREATE TABLE public.tutor_calendar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL UNIQUE REFERENCES public.staff(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_calendar_subscriptions IS
  'Secret per-tutor bearer URLs for read-only, auto-updating timetable calendar feeds.';
COMMENT ON COLUMN public.tutor_calendar_subscriptions.token IS
  'Opaque bearer credential. Never expose through the Data API to anon or authenticated roles.';

ALTER TABLE public.tutor_calendar_subscriptions ENABLE ROW LEVEL SECURITY;

-- This table is intentionally server-only. The tutor-web route authenticates the
-- tutor before provisioning a URL and uses the service role to serve calendar polls.
REVOKE ALL ON TABLE public.tutor_calendar_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_calendar_subscriptions TO service_role;

CREATE TRIGGER set_updated_at_tutor_calendar_subscriptions
  BEFORE UPDATE ON public.tutor_calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
