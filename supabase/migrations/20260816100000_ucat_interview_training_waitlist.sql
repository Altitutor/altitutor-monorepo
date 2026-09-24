ALTER TABLE public.ucat_public_interest_submissions
  DROP CONSTRAINT ucat_public_interest_submissions_kind_check;

ALTER TABLE public.ucat_public_interest_submissions
  ADD CONSTRAINT ucat_public_interest_submissions_kind_check
  CHECK (kind IN (
    'supported_access',
    'online_tutoring_waitlist',
    'interview_training_waitlist'
  ));

ALTER TABLE public.ucat_public_interest_submissions
  DROP CONSTRAINT ucat_public_interest_submissions_reason_check;

ALTER TABLE public.ucat_public_interest_submissions
  ADD CONSTRAINT ucat_public_interest_submissions_reason_check
  CHECK (
    (
      kind = 'supported_access'
      AND char_length(btrim(COALESCE(reason, ''))) BETWEEN 20 AND 3000
    )
    OR (
      kind IN ('online_tutoring_waitlist', 'interview_training_waitlist')
      AND reason IS NULL
    )
  );

ALTER TABLE public.ucat_transactional_email_outbox
  DROP CONSTRAINT ucat_transactional_email_outbox_template_key_check;

ALTER TABLE public.ucat_transactional_email_outbox
  ADD CONSTRAINT ucat_transactional_email_outbox_template_key_check
  CHECK (template_key IN (
    'public_interest_supported_access_received',
    'public_interest_online_tutoring_waitlist_received',
    'public_interest_interview_training_waitlist_received',
    'referral_gift_received',
    'referral_access_gift_earned',
    'referral_billing_credit_earned',
    'referral_free_bill_earned',
    'subscription_activated',
    'subscription_cancellation_scheduled',
    'subscription_cancellation_reversed',
    'subscription_canceled'
  ));

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
      WHEN 'online_tutoring_waitlist'
        THEN 'public_interest_online_tutoring_waitlist_received'
      ELSE 'public_interest_interview_training_waitlist_received'
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
