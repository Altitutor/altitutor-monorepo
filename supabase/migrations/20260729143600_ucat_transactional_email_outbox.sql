-- Durable, retryable transactional UCAT email queue. The queue is populated
-- in the same database transaction as referral rewards and public enquiries,
-- so a temporary email-provider outage cannot lose the customer message.

CREATE TABLE public.ucat_transactional_email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL CHECK (template_key IN (
    'public_interest_supported_access_received',
    'public_interest_online_tutoring_waitlist_received',
    'referral_gift_received',
    'referral_access_gift_earned',
    'referral_billing_credit_earned',
    'referral_free_bill_earned',
    'subscription_activated',
    'subscription_cancellation_scheduled',
    'subscription_cancellation_reversed',
    'subscription_canceled'
  )),
  event_key TEXT NOT NULL UNIQUE CHECK (TRIM(event_key) <> ''),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'suppressed')
  ),
  delivery_status TEXT CHECK (
    delivery_status IS NULL OR delivery_status IN (
      'accepted', 'delivered', 'delayed', 'bounced', 'complained',
      'suppressed', 'failed'
    )
  ),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (
    attempt_count BETWEEN 0 AND 5
  ),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_transactional_email_outbox_email_normalized
    CHECK (recipient_email = LOWER(TRIM(recipient_email))),
  CONSTRAINT ucat_transactional_email_outbox_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT ucat_transactional_email_outbox_sent_consistent
    CHECK ((status = 'sent' AND sent_at IS NOT NULL) OR status <> 'sent')
);

CREATE INDEX ucat_transactional_email_outbox_dispatch_idx
  ON public.ucat_transactional_email_outbox(next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing');
CREATE INDEX ucat_transactional_email_outbox_provider_idx
  ON public.ucat_transactional_email_outbox(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX ucat_transactional_email_outbox_student_idx
  ON public.ucat_transactional_email_outbox(student_id, created_at DESC)
  WHERE student_id IS NOT NULL;

CREATE TRIGGER update_ucat_transactional_email_outbox_updated_at
  BEFORE UPDATE ON public.ucat_transactional_email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ucat_transactional_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_transactional_email_outbox
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ucat_transactional_email_outbox
  TO service_role;

COMMENT ON TABLE public.ucat_transactional_email_outbox IS
  'Service-only durable queue for required UCAT account, access, referral and enquiry emails.';

CREATE OR REPLACE FUNCTION public.queue_ucat_student_transactional_email(
  p_student_id UUID,
  p_template_key TEXT,
  p_event_key TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  recipient TEXT;
  recipient_first_name TEXT;
  queued_id UUID;
BEGIN
  SELECT
    LOWER(TRIM(email)),
    NULLIF(TRIM(first_name), '')
  INTO recipient, recipient_first_name
  FROM public.students
  WHERE id = p_student_id;

  IF recipient IS NULL OR recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Student does not have a deliverable email address';
  END IF;

  INSERT INTO public.ucat_transactional_email_outbox (
    student_id, recipient_email, template_key, event_key, payload
  )
  VALUES (
    p_student_id,
    recipient,
    p_template_key,
    p_event_key,
    jsonb_build_object('first_name', recipient_first_name)
      || COALESCE(p_payload, '{}'::JSONB)
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO queued_id;

  IF queued_id IS NULL THEN
    SELECT id INTO queued_id
    FROM public.ucat_transactional_email_outbox
    WHERE event_key = p_event_key;
  END IF;

  RETURN queued_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.queue_ucat_student_transactional_email(
  UUID, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_ucat_student_transactional_email(
  UUID, TEXT, TEXT, JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ucat_transactional_emails(
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.ucat_transactional_email_outbox
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH candidates AS (
    SELECT id
    FROM public.ucat_transactional_email_outbox
    WHERE attempt_count < 5
      AND (
        (status IN ('pending', 'failed') AND next_attempt_at <= NOW())
        OR (status = 'processing' AND claimed_at <= NOW() - INTERVAL '15 minutes')
      )
    ORDER BY next_attempt_at, created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ucat_transactional_email_outbox outbox
  SET
    status = 'processing',
    attempt_count = outbox.attempt_count + 1,
    claimed_at = NOW(),
    last_error = NULL,
    updated_at = NOW()
  FROM candidates
  WHERE outbox.id = candidates.id
  RETURNING outbox.*;
$function$;

REVOKE ALL ON FUNCTION public.claim_ucat_transactional_emails(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ucat_transactional_emails(INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_ucat_public_interest_ack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.ucat_transactional_email_outbox (
    recipient_email,
    template_key,
    event_key,
    payload
  )
  VALUES (
    LOWER(TRIM(NEW.email)),
    CASE NEW.kind
      WHEN 'supported_access'
        THEN 'public_interest_supported_access_received'
      ELSE 'public_interest_online_tutoring_waitlist_received'
    END,
    'public-interest:' || NEW.id::TEXT || ':received',
    jsonb_build_object(
      'submission_id', NEW.id,
      'first_name', split_part(TRIM(NEW.name), ' ', 1),
      'kind', NEW.kind
    )
  )
  ON CONFLICT (event_key) DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_ucat_public_interest_ack()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_ucat_public_interest_ack
AFTER INSERT ON public.ucat_public_interest_submissions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_ucat_public_interest_ack();

CREATE OR REPLACE FUNCTION public.enqueue_ucat_referral_gift_received_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  referrer_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(first_name), ''), 'A friend')
  INTO referrer_name
  FROM public.students
  WHERE id = NEW.referrer_student_id;

  PERFORM public.queue_ucat_student_transactional_email(
    NEW.referred_student_id,
    'referral_gift_received',
    'referral:' || NEW.id::TEXT || ':gift-received',
    jsonb_build_object(
      'referral_id', NEW.id,
      'referrer_name', referrer_name,
      'duration_interval', NEW.gift_duration_interval,
      'expires_at', NEW.gift_expires_at,
      'action_path', '/settings/plan/referrals?gift=' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_ucat_referral_gift_received_email()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_ucat_referral_gift_received_email
AFTER INSERT ON public.ucat_referrals
FOR EACH ROW EXECUTE FUNCTION public.enqueue_ucat_referral_gift_received_email();

CREATE OR REPLACE FUNCTION public.enqueue_ucat_referral_access_reward_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.queue_ucat_student_transactional_email(
    NEW.student_id,
    'referral_access_gift_earned',
    'referral-access-gift:' || NEW.id::TEXT || ':earned',
    jsonb_build_object(
      'access_gift_id', NEW.id,
      'referral_id', NEW.referral_id,
      'duration_interval', NEW.duration_interval,
      'action_path', '/checkout?tier=unlimited&interval=' ||
        NEW.duration_interval || '&context=referral_gift&gift=' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_ucat_referral_access_reward_email()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_ucat_referral_access_reward_email
AFTER INSERT ON public.ucat_referral_access_gifts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_ucat_referral_access_reward_email();

CREATE OR REPLACE FUNCTION public.enqueue_ucat_referral_bill_reward_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.queue_ucat_student_transactional_email(
    NEW.student_id,
    CASE NEW.reward_type
      WHEN 'fixed_credit' THEN 'referral_billing_credit_earned'
      ELSE 'referral_free_bill_earned'
    END,
    'referral-bill-reward:' || NEW.id::TEXT || ':earned',
    jsonb_build_object(
      'bill_reward_id', NEW.id,
      'referral_id', NEW.referral_id,
      'reward_type', NEW.reward_type,
      'amount_off_cents', NEW.amount_off_cents,
      'action_path', '/settings/plan/referrals'
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_ucat_referral_bill_reward_email()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_ucat_referral_bill_reward_email
AFTER INSERT ON public.ucat_referral_bill_rewards
FOR EACH ROW EXECUTE FUNCTION public.enqueue_ucat_referral_bill_reward_email();

CREATE OR REPLACE FUNCTION public.get_ucat_email_dispatch_secret()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  secret TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
    WHERE name = 'ucat_email_dispatch_secret';
  EXCEPTION WHEN OTHERS THEN
    secret := NULL;
  END;
  RETURN NULLIF(secret, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ucat_email_dispatch_secret()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ucat_email_dispatch_secret() TO postgres;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping UCAT email dispatcher: pg_cron or pg_net unavailable.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'ucat-transactional-email-dispatch';

  PERFORM cron.schedule(
    'ucat-transactional-email-dispatch',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() ||
          '/functions/v1/ucat-transactional-email-dispatch',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' ||
            public.get_ucat_email_dispatch_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{"limit":50}'::jsonb,
        timeout_milliseconds := 50000
      );
    $cron$
  );
END;
$block$;
