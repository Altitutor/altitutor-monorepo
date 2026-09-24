-- One durable inbox serves every app. app_scope controls which surface may
-- present a notification; notification_type identifies its domain meaning.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS app_scope text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.notifications
SET app_scope = CASE
  WHEN student_id IS NOT NULL THEN 'student_web'
  ELSE 'staff_web'
END
WHERE app_scope IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN app_scope SET NOT NULL,
  DROP CONSTRAINT IF EXISTS notifications_app_scope_check,
  ADD CONSTRAINT notifications_app_scope_check
    CHECK (app_scope IN ('student_web', 'ucat_web', 'staff_web')),
  DROP CONSTRAINT IF EXISTS notifications_priority_check,
  ADD CONSTRAINT notifications_priority_check
    CHECK (priority IN ('normal', 'important', 'critical')),
  DROP CONSTRAINT IF EXISTS notifications_metadata_object_check,
  ADD CONSTRAINT notifications_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  DROP CONSTRAINT IF EXISTS notifications_dedupe_key_unique,
  ADD CONSTRAINT notifications_dedupe_key_unique UNIQUE (dedupe_key);

CREATE OR REPLACE FUNCTION public.set_notification_app_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.app_scope IS NULL THEN
    NEW.app_scope := CASE
      WHEN NEW.student_id IS NOT NULL THEN 'student_web'
      ELSE 'staff_web'
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_notification_app_scope()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_notification_app_scope ON public.notifications;
CREATE TRIGGER set_notification_app_scope
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_app_scope();

CREATE INDEX IF NOT EXISTS idx_notifications_student_scope_created
  ON public.notifications(student_id, app_scope, created_at DESC)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_student_scope_unread
  ON public.notifications(student_id, app_scope, created_at DESC)
  WHERE student_id IS NOT NULL AND read_at IS NULL AND resolved_at IS NULL;

DROP POLICY IF EXISTS "Students can read own notifications"
  ON public.notifications;
CREATE POLICY "Students can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

DROP POLICY IF EXISTS "Tutors can read own notifications"
  ON public.notifications;
CREATE POLICY "Tutors can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (staff_id = (SELECT public.current_tutor_id()));

GRANT SELECT ON public.notifications TO authenticated;

DROP VIEW IF EXISTS public.vstudent_notifications;
DROP VIEW IF EXISTS public.vucat_notifications;
DROP VIEW IF EXISTS public.vtutor_notifications;

CREATE VIEW public.vstudent_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.student_id,
  n.activity_event_id,
  n.notification_type,
  n.app_scope,
  n.title,
  n.body,
  n.read_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.student_id = (SELECT public.current_student_id())
  AND n.app_scope = 'student_web'
ORDER BY n.created_at DESC;

CREATE VIEW public.vucat_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.student_id,
  n.notification_type,
  n.title,
  n.body,
  n.read_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.student_id = (SELECT public.current_student_id())
  AND n.app_scope = 'ucat_web'
ORDER BY n.created_at DESC;

CREATE VIEW public.vtutor_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.staff_id,
  n.activity_event_id,
  n.notification_type,
  n.app_scope,
  n.title,
  n.body,
  n.read_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.staff_id = (SELECT public.current_tutor_id())
  AND n.app_scope = 'staff_web'
ORDER BY n.created_at DESC;

GRANT SELECT ON public.vstudent_notifications TO authenticated;
GRANT SELECT ON public.vucat_notifications TO authenticated;
GRANT SELECT ON public.vtutor_notifications TO authenticated;

COMMENT ON COLUMN public.notifications.app_scope IS
  'Application surface that owns presentation of this inbox item.';
COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Globally stable producer key used to make notification creation idempotent.';
COMMENT ON COLUMN public.notifications.resolved_at IS
  'When the underlying actionable condition was resolved; independent of read state.';

-- Referral attribution and both reset grants remain one transaction. The two
-- recipient-specific notifications intentionally bundle attribution and reward
-- to avoid sending each student two notices for one referral.
CREATE OR REPLACE FUNCTION public.grant_ucat_free_referral_resets_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_referrer_name text;
  v_referred_name text;
BEGIN
  INSERT INTO public.ucat_free_quota_reset_entitlements (
    student_id,
    expires_at,
    grant_source,
    referral_id
  )
  VALUES
    (NEW.referrer_student_id, now() + interval '30 days', 'referral', NEW.id),
    (NEW.referred_student_id, now() + interval '30 days', 'referral', NEW.id)
  ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

  SELECT coalesce(nullif(trim(first_name), ''), 'A new student')
  INTO v_referred_name
  FROM public.students
  WHERE id = NEW.referred_student_id;

  SELECT coalesce(nullif(trim(first_name), ''), 'your friend')
  INTO v_referrer_name
  FROM public.students
  WHERE id = NEW.referrer_student_id;

  INSERT INTO public.notifications (
    student_id,
    notification_type,
    app_scope,
    title,
    body,
    action_url,
    metadata,
    dedupe_key
  )
  VALUES
    (
      NEW.referrer_student_id,
      'ucat.referral.link_used',
      'ucat_web',
      'Your referral link was used',
      v_referred_name || ' joined with your link. You received a Free quota reset.',
      '/settings/plan/referrals',
      jsonb_build_object('referral_id', NEW.id, 'reward', 'free_quota_reset'),
      'ucat:referral:' || NEW.id::text || ':referrer'
    ),
    (
      NEW.referred_student_id,
      'ucat.referral.link_applied',
      'ucat_web',
      'Your referral reward is ready',
      'You joined with ' || v_referrer_name || '''s link. You both received a Free quota reset.',
      '/settings/plan/referrals',
      jsonb_build_object('referral_id', NEW.id, 'reward', 'free_quota_reset'),
      'ucat:referral:' || NEW.id::text || ':referred'
    )
  ON CONFLICT (dedupe_key) DO NOTHING;

  UPDATE public.ucat_referrals
  SET free_qualified_at = now(), updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Operational admin resets are already durable events, so they can generate a
-- notification without coupling the admin UI to UCAT web implementation.
CREATE OR REPLACE FUNCTION public.notify_ucat_admin_quota_reset_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_area_label text;
BEGIN
  IF NEW.source <> 'admin' THEN
    RETURN NEW;
  END IF;

  v_area_label := initcap(replace(coalesce(NEW.quota_area, 'UCAT Free'), '_', ' '));

  INSERT INTO public.notifications (
    student_id,
    notification_type,
    app_scope,
    title,
    body,
    action_url,
    metadata,
    dedupe_key,
    created_by_staff_id
  )
  VALUES (
    NEW.student_id,
    'ucat.quota_reset.granted',
    'ucat_web',
    'Your Free quota was reset',
    'Your ' || v_area_label || ' allowance has been reset by the Altitutor team.',
    '/dashboard',
    jsonb_build_object('quota_reset_event_id', NEW.id, 'quota_area', NEW.quota_area),
    'ucat:quota-reset:event:' || NEW.id::text,
    NEW.created_by_staff_id
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_admin_quota_reset_on_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_ucat_admin_quota_reset_on_insert
  ON public.ucat_free_quota_reset_events;
CREATE TRIGGER notify_ucat_admin_quota_reset_on_insert
AFTER INSERT ON public.ucat_free_quota_reset_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_admin_quota_reset_on_insert();

CREATE OR REPLACE FUNCTION public.notify_ucat_referral_free_bill_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    student_id,
    notification_type,
    app_scope,
    title,
    body,
    action_url,
    metadata,
    dedupe_key,
    priority
  )
  VALUES (
    NEW.student_id,
    'ucat.referral.free_bill_earned',
    'ucat_web',
    'Your next bill is free',
    'A paid referral qualified. Your oldest available free-bill reward will be applied automatically at renewal.',
    '/settings/plan/referrals',
    jsonb_build_object('referral_id', NEW.referral_id, 'bill_reward_id', NEW.id),
    'ucat:referral:free-bill:' || NEW.id::text,
    'important'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_referral_free_bill_on_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_ucat_referral_free_bill_on_insert
  ON public.ucat_referral_bill_rewards;
CREATE TRIGGER notify_ucat_referral_free_bill_on_insert
AFTER INSERT ON public.ucat_referral_bill_rewards
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_referral_free_bill_on_insert();
