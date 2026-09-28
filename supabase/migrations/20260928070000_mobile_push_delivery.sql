-- Mobile push mirrors selected durable student inbox notices. Registration and
-- preferences are written by authenticated product API routes using service
-- role; students and tutors do not receive base-table privileges.
CREATE TABLE public.mobile_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  app_scope text NOT NULL CHECK (app_scope IN ('student_web', 'ucat_web')),
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mobile_push_devices_student_scope_idx
  ON public.mobile_push_devices (student_id, app_scope);

CREATE TABLE public.mobile_push_preferences (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  app_scope text NOT NULL CHECK (app_scope IN ('student_web', 'ucat_web')),
  category text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, app_scope, category),
  CONSTRAINT mobile_push_preferences_category_check CHECK (
    (app_scope = 'student_web' AND category IN ('sessions', 'payments'))
    OR
    (app_scope = 'ucat_web' AND category IN
      ('payments', 'referrals', 'quota_grants', 'quota_limits', 'new_content'))
  )
);

CREATE TABLE public.mobile_push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.mobile_push_devices(id) ON DELETE CASCADE,
  category text NOT NULL,
  push_day date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'ticket', 'delivered', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  ticket_id text,
  receipt_due_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, device_id)
);

CREATE INDEX mobile_push_deliveries_send_idx
  ON public.mobile_push_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'sending');
CREATE INDEX mobile_push_deliveries_receipt_idx
  ON public.mobile_push_deliveries (receipt_due_at)
  WHERE status = 'ticket';
CREATE UNIQUE INDEX mobile_push_content_once_daily_idx
  ON public.mobile_push_deliveries (device_id, category, push_day)
  WHERE category = 'new_content';

-- Select the first content notice for the account each Adelaide day before
-- fanning it out to devices. A device registered later cannot cause a second
-- notice from that day to be pushed to the same student.
CREATE TABLE public.mobile_push_content_days (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  app_scope text NOT NULL CHECK (app_scope = 'ucat_web'),
  category text NOT NULL CHECK (category = 'new_content'),
  push_day date NOT NULL,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, app_scope, category, push_day)
);

-- An Expo token can be re-registered after a different student signs in on
-- the same installation. Never deliver that previous student's queued notices.
CREATE FUNCTION public.clear_reassigned_mobile_push_deliveries()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.app_scope IS DISTINCT FROM OLD.app_scope THEN
    DELETE FROM public.mobile_push_deliveries WHERE device_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_reassigned_mobile_push_deliveries()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER clear_reassigned_mobile_push_deliveries
  BEFORE UPDATE ON public.mobile_push_devices
  FOR EACH ROW EXECUTE FUNCTION public.clear_reassigned_mobile_push_deliveries();

ALTER TABLE public.mobile_push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_push_content_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_push_devices, public.mobile_push_preferences,
  public.mobile_push_deliveries, public.mobile_push_content_days
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_push_devices,
  public.mobile_push_preferences, public.mobile_push_deliveries,
  public.mobile_push_content_days TO service_role;

CREATE FUNCTION public.mobile_push_category(p_scope text, p_type text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_scope = 'student_web' AND p_type = 'STUDENT_ABSENCE_LOGGED'
      THEN 'sessions'
    WHEN p_scope = 'student_web' AND p_type = 'INVOICE_OVERDUE'
      THEN 'payments'
    WHEN p_scope = 'ucat_web' AND p_type IN (
      'ucat.billing.payment_failed',
      'ucat.billing.payment_action_required',
      'ucat.billing.invoice_finalization_failed',
      'ucat.billing.payment_recovered',
      'ucat.billing.access_ended'
    ) THEN 'payments'
    WHEN p_scope = 'ucat_web' AND p_type IN (
      'ucat.referral.gift_pending',
      'ucat.referral.gift_rejected_reset',
      'ucat.referral.free_rejection_reset',
      'ucat.referral.access_gift_earned',
      'ucat.referral.billing_credit_earned',
      'ucat.referral.free_bill_earned'
    ) THEN 'referrals'
    WHEN p_scope = 'ucat_web' AND p_type = 'ucat.quota_reset.granted'
      THEN 'quota_grants'
    WHEN p_scope = 'ucat_web' AND p_type = 'ucat.quota.limit_reached'
      THEN 'quota_limits'
    WHEN p_scope = 'ucat_web' AND p_type IN (
      'ucat.content.sets_released',
      'ucat.content.mocks_released',
      'ucat.content.learning_released'
    ) THEN 'new_content'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION public.mobile_push_category(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_push_category(text, text) TO service_role;

CREATE FUNCTION public.enqueue_mobile_push_delivery()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category text;
  v_default boolean;
  v_push_day date;
BEGIN
  IF NEW.student_id IS NULL OR NEW.app_scope NOT IN ('student_web', 'ucat_web')
     OR NEW.resolved_at IS NOT NULL OR NEW.dismissed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_category := public.mobile_push_category(NEW.app_scope, NEW.notification_type);
  IF v_category IS NULL THEN RETURN NEW; END IF;
  v_default := v_category NOT IN ('quota_limits', 'new_content');
  IF v_category = 'new_content' THEN
    v_push_day := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Australia/Adelaide')::date;
    INSERT INTO public.mobile_push_content_days
      (student_id, app_scope, category, push_day, notification_id)
    VALUES (NEW.student_id, NEW.app_scope, v_category, v_push_day, NEW.id)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.mobile_push_deliveries
    (notification_id, device_id, category, push_day)
  SELECT NEW.id, d.id, v_category, v_push_day
  FROM public.mobile_push_devices d
  LEFT JOIN public.mobile_push_preferences p
    ON p.student_id = d.student_id AND p.app_scope = d.app_scope
      AND p.category = v_category
  WHERE d.student_id = NEW.student_id AND d.app_scope = NEW.app_scope
    AND COALESCE(p.enabled, v_default)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_mobile_push_delivery()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enqueue_mobile_push_delivery
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_mobile_push_delivery();

CREATE FUNCTION public.claim_mobile_push_deliveries(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid, expo_push_token text, notification_id uuid, app_scope text,
  student_id uuid, category text, notification_type text,
  expires_at timestamptz, resolved_at timestamptz, dismissed_at timestamptz,
  preference_enabled boolean
)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidate AS (
    SELECT delivery.id
    FROM public.mobile_push_deliveries delivery
    WHERE delivery.status IN ('pending', 'sending')
      AND delivery.next_attempt_at <= now()
      AND (delivery.lease_expires_at IS NULL OR delivery.lease_expires_at < now())
      AND delivery.attempts < 8
    ORDER BY delivery.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.mobile_push_deliveries delivery
    SET status = 'sending', attempts = delivery.attempts + 1,
      lease_expires_at = now() + interval '2 minutes', updated_at = now()
    FROM candidate
    WHERE delivery.id = candidate.id
    RETURNING delivery.*
  )
  SELECT claimed.id, device.expo_push_token, claimed.notification_id,
    device.app_scope, device.student_id, claimed.category,
    notification.notification_type, notification.expires_at,
    notification.resolved_at, notification.dismissed_at,
    COALESCE(preference.enabled, claimed.category NOT IN ('quota_limits', 'new_content'))
  FROM claimed
  JOIN public.mobile_push_devices device ON device.id = claimed.device_id
  JOIN public.notifications notification
    ON notification.id = claimed.notification_id
      AND notification.student_id = device.student_id
      AND notification.app_scope = device.app_scope
  LEFT JOIN public.mobile_push_preferences preference
    ON preference.student_id = device.student_id
      AND preference.app_scope = device.app_scope
      AND preference.category = claimed.category
$$;
REVOKE ALL ON FUNCTION public.claim_mobile_push_deliveries(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_push_deliveries(integer)
  TO service_role;

CREATE FUNCTION public.claim_mobile_push_receipts(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, ticket_id text, expo_push_token text)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidate AS (
    SELECT delivery.id
    FROM public.mobile_push_deliveries delivery
    WHERE delivery.status = 'ticket'
      AND delivery.receipt_due_at <= now()
      AND (delivery.lease_expires_at IS NULL OR delivery.lease_expires_at < now())
    ORDER BY delivery.receipt_due_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.mobile_push_deliveries delivery
    SET lease_expires_at = now() + interval '2 minutes', updated_at = now()
    FROM candidate
    WHERE delivery.id = candidate.id
    RETURNING delivery.id, delivery.ticket_id
  )
  SELECT claimed.id, claimed.ticket_id, device.expo_push_token
  FROM claimed
  JOIN public.mobile_push_deliveries delivery ON delivery.id = claimed.id
  JOIN public.mobile_push_devices device ON device.id = delivery.device_id
$$;
REVOKE ALL ON FUNCTION public.claim_mobile_push_receipts(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_push_receipts(integer)
  TO service_role;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping mobile push scheduler: pg_cron or pg_net unavailable.';
    RETURN;
  END IF;
  IF public.get_supabase_url() IS NULL OR public.get_service_role_key() IS NULL THEN
    RAISE NOTICE 'Skipping mobile push scheduler: project URL or service role Vault secret missing.';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job
    WHERE jobname = 'mobile-push-dispatch';
  PERFORM cron.schedule(
    'mobile-push-dispatch',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/mobile-push-dispatch',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_service_role_key(),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
END;
$block$;
