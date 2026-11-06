-- Tutor mobile delivery shares the durable staff inbox and delivery worker.
-- Keep student and staff ownership mutually exclusive for every registration.
ALTER TABLE public.mobile_push_devices
  ADD COLUMN staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  ADD COLUMN staff_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN staff_session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE,
  ALTER COLUMN student_id DROP NOT NULL,
  DROP CONSTRAINT mobile_push_devices_app_scope_check,
  ADD CONSTRAINT mobile_push_devices_recipient_scope_check CHECK (
    (app_scope IN ('student_web', 'ucat_web')
      AND student_id IS NOT NULL AND staff_id IS NULL
      AND staff_user_id IS NULL AND staff_session_id IS NULL)
    OR (app_scope = 'staff_web'
      AND student_id IS NULL AND staff_id IS NOT NULL
      AND staff_user_id IS NOT NULL AND staff_session_id IS NOT NULL)
  );

CREATE INDEX mobile_push_devices_staff_idx
  ON public.mobile_push_devices (staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX mobile_push_devices_staff_user_idx
  ON public.mobile_push_devices (staff_user_id) WHERE staff_user_id IS NOT NULL;
CREATE INDEX mobile_push_devices_staff_session_idx
  ON public.mobile_push_devices (staff_session_id) WHERE staff_session_id IS NOT NULL;

ALTER TABLE public.mobile_push_preferences
  ADD COLUMN staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  DROP CONSTRAINT mobile_push_preferences_pkey,
  ALTER COLUMN student_id DROP NOT NULL,
  DROP CONSTRAINT mobile_push_preferences_app_scope_check,
  DROP CONSTRAINT mobile_push_preferences_category_check,
  ADD CONSTRAINT mobile_push_preferences_student_scope_category_key
    UNIQUE (student_id, app_scope, category),
  ADD CONSTRAINT mobile_push_preferences_staff_scope_category_key
    UNIQUE (staff_id, app_scope, category),
  ADD CONSTRAINT mobile_push_preferences_recipient_category_check CHECK (
    (student_id IS NOT NULL AND staff_id IS NULL AND (
      (app_scope = 'student_web' AND category IN ('sessions', 'payments'))
      OR (app_scope = 'ucat_web' AND category IN
        ('payments', 'referrals', 'quota_grants', 'quota_limits', 'new_content'))
    ))
    OR (student_id IS NULL AND staff_id IS NOT NULL
      AND app_scope = 'staff_web' AND category = 'tutor_updates')
  );

CREATE OR REPLACE FUNCTION public.clear_reassigned_mobile_push_deliveries()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Existing student clients do not send staff columns on token upsert.
  IF OLD.app_scope = 'staff_web' AND NEW.app_scope IN ('student_web', 'ucat_web') THEN
    NEW.staff_id := NULL;
    NEW.staff_user_id := NULL;
    NEW.staff_session_id := NULL;
  END IF;

  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
     OR NEW.staff_user_id IS DISTINCT FROM OLD.staff_user_id
     OR NEW.staff_session_id IS DISTINCT FROM OLD.staff_session_id
     OR NEW.expo_push_token IS DISTINCT FROM OLD.expo_push_token
     OR NEW.platform IS DISTINCT FROM OLD.platform
     OR NEW.app_scope IS DISTINCT FROM OLD.app_scope THEN
    DELETE FROM public.mobile_push_deliveries WHERE device_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mobile_push_category(p_scope text, p_type text)
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
    WHEN p_scope = 'staff_web' THEN 'tutor_updates'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.enqueue_mobile_push_delivery()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category text;
  v_default boolean;
  v_push_day date;
BEGIN
  IF NEW.resolved_at IS NOT NULL OR NEW.dismissed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_category := public.mobile_push_category(NEW.app_scope, NEW.notification_type);
  IF v_category IS NULL OR (NEW.app_scope = 'ucat_web' AND NEW.student_id IS NULL) THEN
    RETURN NEW;
  END IF;
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
    ON p.app_scope = d.app_scope AND p.category = v_category
      AND (p.student_id = d.student_id OR p.staff_id = d.staff_id)
  WHERE d.app_scope = NEW.app_scope
    AND (
      d.student_id = NEW.student_id
      OR (d.staff_id = NEW.staff_id AND EXISTS (
        SELECT 1
        FROM public.staff staff
        JOIN auth.sessions session ON session.user_id = staff.user_id
        WHERE staff.id = d.staff_id AND staff.user_id = d.staff_user_id
          AND session.id = d.staff_session_id
          AND (session.not_after IS NULL OR session.not_after > now())
          AND staff.role IN ('TUTOR', 'ADMINSTAFF') AND staff.status IN ('ACTIVE', 'TRIAL')
      ))
    )
    AND COALESCE(p.enabled, v_default)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.claim_mobile_push_deliveries(integer);
CREATE FUNCTION public.claim_mobile_push_deliveries(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid, expo_push_token text, notification_id uuid, app_scope text,
  student_id uuid, category text, notification_type text,
  expires_at timestamptz, resolved_at timestamptz, dismissed_at timestamptz,
  preference_enabled boolean, lease_expires_at timestamptz
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
      AND (device.staff_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.staff staff
        JOIN auth.sessions session ON session.user_id = staff.user_id
        WHERE staff.id = device.staff_id AND staff.user_id = device.staff_user_id
          AND session.id = device.staff_session_id
          AND (session.not_after IS NULL OR session.not_after > now())
          AND staff.role IN ('TUTOR', 'ADMINSTAFF') AND staff.status IN ('ACTIVE', 'TRIAL')
      )),
    claimed.lease_expires_at
  FROM claimed
  JOIN public.mobile_push_devices device ON device.id = claimed.device_id
  JOIN public.notifications notification
    ON notification.id = claimed.notification_id
      AND notification.app_scope = device.app_scope
      AND (notification.student_id = device.student_id OR notification.staff_id = device.staff_id)
  LEFT JOIN public.mobile_push_preferences preference
    ON preference.app_scope = device.app_scope AND preference.category = claimed.category
      AND (preference.student_id = device.student_id OR preference.staff_id = device.staff_id)
$$;

REVOKE ALL ON FUNCTION public.claim_mobile_push_deliveries(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_push_deliveries(integer) TO service_role;

DROP FUNCTION public.claim_mobile_push_receipts(integer);
CREATE FUNCTION public.claim_mobile_push_receipts(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, ticket_id text, expo_push_token text, lease_expires_at timestamptz)
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
    RETURNING delivery.id, delivery.ticket_id, delivery.device_id, delivery.lease_expires_at
  )
  SELECT claimed.id, claimed.ticket_id, device.expo_push_token, claimed.lease_expires_at
  FROM claimed
  JOIN public.mobile_push_devices device ON device.id = claimed.device_id
$$;
REVOKE ALL ON FUNCTION public.claim_mobile_push_receipts(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_push_receipts(integer)
  TO service_role;

CREATE FUNCTION public.retire_mobile_push_device(
  p_delivery_id uuid, p_expo_push_token text, p_status text, p_lease_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_device_id uuid;
BEGIN
  -- Use the same device-then-delivery lock order as registration reassignment
  -- and logout. Check the claim after locking the current registration.
  SELECT device.id INTO v_device_id
  FROM public.mobile_push_devices device
  WHERE device.expo_push_token = p_expo_push_token
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM 1
  FROM public.mobile_push_deliveries delivery
  WHERE delivery.id = p_delivery_id AND delivery.device_id = v_device_id
    AND delivery.status = p_status AND p_status IN ('sending', 'ticket')
    AND delivery.lease_expires_at = p_lease_expires_at
  FOR UPDATE;
  IF NOT FOUND OR p_lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;

  DELETE FROM public.mobile_push_devices WHERE id = v_device_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.retire_mobile_push_device(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retire_mobile_push_device(uuid, text, text, timestamptz)
  TO service_role;
