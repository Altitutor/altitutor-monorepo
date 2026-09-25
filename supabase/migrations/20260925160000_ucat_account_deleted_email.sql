ALTER TABLE public.ucat_transactional_email_outbox
  DROP CONSTRAINT ucat_transactional_email_outbox_template_key_check;

ALTER TABLE public.ucat_transactional_email_outbox
  ADD CONSTRAINT ucat_transactional_email_outbox_template_key_check
  CHECK (template_key IN (
    'public_interest_supported_access_received',
    'public_interest_online_tutoring_waitlist_received',
    'public_interest_interview_training_waitlist_received',
    'public_interest_admin_notification',
    'referral_gift_received',
    'referral_access_gift_earned',
    'referral_billing_credit_earned',
    'referral_free_bill_earned',
    'subscription_activated',
    'subscription_cancellation_scheduled',
    'subscription_cancellation_reversed',
    'subscription_canceled',
    'ucat_account_deleted'
  ));
