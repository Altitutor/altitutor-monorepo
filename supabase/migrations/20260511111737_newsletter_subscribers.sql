-- Migration: Add newsletter subscribers
-- Description: Capture marketing email consent independently from signup completion.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  resend_audience_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email),
  CONSTRAINT newsletter_subscribers_unsubscribe_token_unique UNIQUE (unsubscribe_token),
  CONSTRAINT newsletter_subscribers_email_normalized CHECK (email = LOWER(TRIM(email))),
  CONSTRAINT newsletter_subscribers_email_present CHECK (email <> ''),
  CONSTRAINT newsletter_subscribers_source_present CHECK (TRIM(source) <> '')
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_student_id
  ON public.newsletter_subscribers(student_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active_email
  ON public.newsletter_subscribers(email)
  WHERE unsubscribed_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_newsletter_subscribers ON public.newsletter_subscribers;
CREATE TRIGGER set_updated_at_newsletter_subscribers
BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "ADMINSTAFF full access to newsletter_subscribers"
  ON public.newsletter_subscribers
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;

COMMENT ON TABLE public.newsletter_subscribers IS 'Marketing newsletter subscribers captured by email, optionally linked to a student profile after signup completion.';
COMMENT ON COLUMN public.newsletter_subscribers.source IS 'Signup surface that captured consent, for example ucat_signup.';
