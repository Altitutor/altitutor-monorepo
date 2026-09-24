-- Greenfield UCAT optional-email programme: campaign controls, measurement,
-- familiarity-scoped onboarding evidence, and a service-only candidate view.

ALTER TABLE public.students
  ADD COLUMN ucat_initial_familiarity TEXT,
  ADD CONSTRAINT students_ucat_initial_familiarity_check
    CHECK (
      ucat_initial_familiarity IS NULL
      OR ucat_initial_familiarity IN ('new', 'familiar', 'experienced')
    );

COMMENT ON COLUMN public.students.ucat_initial_familiarity IS
  'Student-selected UCAT familiarity at onboarding. It scopes the introductory teaching curriculum and is not inferred from later performance.';

CREATE TABLE public.ucat_email_program_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  holdout_percentage SMALLINT NOT NULL DEFAULT 10
    CHECK (holdout_percentage BETWEEN 0 AND 50),
  measurement_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  measurement_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 weeks'),
  broadcast_suppression_starts_at TIMESTAMPTZ,
  broadcast_suppression_ends_at TIMESTAMPTZ,
  broadcast_label TEXT,
  updated_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_email_program_settings_measurement_window
    CHECK (measurement_ends_at > measurement_started_at),
  CONSTRAINT ucat_email_program_settings_broadcast_window
    CHECK (
      (broadcast_suppression_starts_at IS NULL
        AND broadcast_suppression_ends_at IS NULL)
      OR (
        broadcast_suppression_starts_at IS NOT NULL
        AND broadcast_suppression_ends_at IS NOT NULL
        AND broadcast_suppression_ends_at > broadcast_suppression_starts_at
      )
    )
);

INSERT INTO public.ucat_email_program_settings (singleton) VALUES (TRUE);

CREATE INDEX ucat_email_program_settings_updated_by_staff_idx
  ON public.ucat_email_program_settings(updated_by_staff_id)
  WHERE updated_by_staff_id IS NOT NULL;

CREATE TRIGGER update_ucat_email_program_settings_updated_at
  BEFORE UPDATE ON public.ucat_email_program_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ucat_email_campaign_controls (
  campaign_key TEXT PRIMARY KEY CHECK (TRIM(campaign_key) <> ''),
  display_name TEXT NOT NULL CHECK (TRIM(display_name) <> ''),
  topic TEXT NOT NULL CHECK (topic IN (
    'weekly_progress_and_guidance',
    'lessons_and_tips',
    'product_news',
    'offers_and_referrals'
  )),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 1000),
  cooldown_days SMALLINT NOT NULL DEFAULT 0 CHECK (cooldown_days BETWEEN 0 AND 365),
  updated_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ucat_email_campaign_controls (
  campaign_key, display_name, topic, priority, cooldown_days
)
VALUES
  ('onboarding_starting_point', 'Onboarding 1 · Starting point', 'lessons_and_tips', 80, 0),
  ('onboarding_technique', 'Onboarding 2 · High-value technique', 'lessons_and_tips', 80, 0),
  ('onboarding_timing', 'Onboarding 3 · Timing and decisions', 'lessons_and_tips', 80, 0),
  ('onboarding_plan', 'Onboarding 4 · Study planning', 'lessons_and_tips', 80, 0),
  ('first_score_estimate', 'First score estimate', 'weekly_progress_and_guidance', 100, 0),
  ('weekly_review', 'Weekly preparation review', 'weekly_progress_and_guidance', 90, 0),
  ('gentle_restart', 'Gentle restart', 'weekly_progress_and_guidance', 70, 30),
  ('upgrade_quota', 'Upgrade · quota friction', 'offers_and_referrals', 60, 30),
  ('upgrade_consistency', 'Upgrade · positive consistency', 'offers_and_referrals', 50, 30),
  ('referral_invitation', 'Unlimited referral invitation', 'offers_and_referrals', 50, 60),
  ('product_news', 'Product-news broadcasts', 'product_news', 40, 30);

CREATE INDEX ucat_email_campaign_controls_updated_by_staff_idx
  ON public.ucat_email_campaign_controls(updated_by_staff_id)
  WHERE updated_by_staff_id IS NOT NULL;

CREATE TRIGGER update_ucat_email_campaign_controls_updated_at
  BEFORE UPDATE ON public.ucat_email_campaign_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ucat_email_program_assignments (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  cohort TEXT NOT NULL CHECK (cohort IN ('treatment', 'holdout')),
  bucket SMALLINT NOT NULL CHECK (bucket BETWEEN 0 AND 99),
  posthog_synced_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.assign_ucat_email_program_cohort()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $function$
DECLARE
  holdout SMALLINT;
  assigned_bucket SMALLINT;
BEGIN
  SELECT holdout_percentage INTO holdout
  FROM public.ucat_email_program_settings
  WHERE singleton = TRUE;

  assigned_bucket := (
    GET_BYTE(extensions.digest(NEW.student_id::TEXT, 'sha256'), 0)::INTEGER * 256
    + GET_BYTE(extensions.digest(NEW.student_id::TEXT, 'sha256'), 1)::INTEGER
  ) % 100;

  INSERT INTO public.ucat_email_program_assignments (
    student_id, cohort, bucket
  ) VALUES (
    NEW.student_id,
    CASE WHEN assigned_bucket < COALESCE(holdout, 10)
      THEN 'holdout' ELSE 'treatment' END,
    assigned_bucket
  )
  ON CONFLICT (student_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_ucat_email_program_cohort()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER assign_ucat_email_program_cohort_after_preferences
  AFTER INSERT ON public.ucat_communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.assign_ucat_email_program_cohort();

CREATE TABLE public.ucat_email_program_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('send', 'dry_run')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  scanned_count INTEGER NOT NULL DEFAULT 0 CHECK (scanned_count >= 0),
  eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  result_summary JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(result_summary) = 'object'),
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ucat_email_program_runs_started_idx
  ON public.ucat_email_program_runs(started_at DESC);

CREATE TABLE public.ucat_email_broadcast_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL CHECK (TRIM(label) <> ''),
  resend_broadcast_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_email_broadcast_windows_range CHECK (ends_at > starts_at)
);

CREATE INDEX ucat_email_broadcast_windows_active_idx
  ON public.ucat_email_broadcast_windows(starts_at, ends_at);
CREATE INDEX ucat_email_broadcast_windows_staff_idx
  ON public.ucat_email_broadcast_windows(created_by_staff_id)
  WHERE created_by_staff_id IS NOT NULL;

ALTER TABLE public.ucat_email_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_email_campaign_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_email_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_email_program_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_email_broadcast_windows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ucat_email_program_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ucat_email_campaign_controls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ucat_email_program_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ucat_email_program_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ucat_email_broadcast_windows FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON public.ucat_email_program_settings TO service_role;
GRANT SELECT, UPDATE ON public.ucat_email_campaign_controls TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ucat_email_program_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ucat_email_program_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ucat_email_broadcast_windows TO service_role;

COMMENT ON TABLE public.ucat_email_program_settings IS
  'Singleton operational settings for the UCAT optional-email programme.';
COMMENT ON TABLE public.ucat_email_campaign_controls IS
  'Code-defined UCAT campaigns with admin-controlled enablement, priority, and cooldown.';
COMMENT ON TABLE public.ucat_email_program_assignments IS
  'Stable treatment or programme-holdout assignment for each opted-in UCAT student.';
COMMENT ON TABLE public.ucat_email_program_runs IS
  'Operational summary of each lifecycle scheduler invocation.';
COMMENT ON TABLE public.ucat_email_broadcast_windows IS
  'Scheduled product-news windows that temporarily displace automated optional email.';

-- The scheduler paginates this service-only view by student_id. Eligibility
-- and priority stay in code, while all evidence is fetched without N+1 reads.
DROP VIEW IF EXISTS public.vinternal_ucat_lifecycle_email_candidates;

CREATE VIEW public.vinternal_ucat_lifecycle_email_candidates
WITH (security_invoker = TRUE)
AS
SELECT
  preferences.student_id,
  student.user_id AS auth_user_id,
  LOWER(TRIM(student.email)) AS email,
  student.first_name,
  student.last_name,
  student.timezone,
  student.status,
  student.ucat_signup_completed_at,
  student.ucat_initial_familiarity,
  assignment.cohort AS email_program_cohort,
  assignment.bucket AS email_program_bucket,
  assignment.posthog_synced_at AS email_program_posthog_synced_at,
  preferences.weekly_progress_and_guidance,
  preferences.lessons_and_tips,
  preferences.product_news,
  preferences.offers_and_referrals,
  preferences.unsubscribe_token,
  subscriber.consent_verified_at,
  subscriber.unsubscribed_at,
  public.get_student_ucat_online_tier(student.id) AS online_tier,
  subscription.started_at AS unlimited_started_at,
  subscription.billing_interval,
  activity.last_activity_at,
  activity.questions_last_7_days,
  activity.sets_last_7_days,
  activity.mocks_last_7_days,
  activity.active_days_last_7_days,
  activity.active_days_last_14_days,
  consistency.qualifying_days_last_7_days,
  (plan.student_id IS NOT NULL) AS has_study_plan,
  next_step.title AS next_step_title,
  next_step.launch_path AS next_step_path,
  projection.current_estimate,
  projection.first_estimate_generated_at,
  projection.previous_week_estimate,
  quota.last_quota_reached_at,
  quota.last_quota_area,
  referral.has_open_referral_or_reward,
  config.min_questions_per_day,
  config.currency,
  pricing.monthly_base_price_cents,
  pricing.monthly_discount_per_day_cents,
  pricing.monthly_max_discount_days,
  delivery.last_optional_sent_at,
  delivery.last_restart_sent_at,
  delivery.last_upgrade_sent_at,
  delivery.last_referral_sent_at,
  delivery.sent_onboarding_starting_point,
  delivery.sent_onboarding_technique,
  delivery.sent_onboarding_timing,
  delivery.sent_onboarding_plan,
  delivery.sent_first_score_estimate
FROM public.ucat_communication_preferences preferences
JOIN public.students student ON student.id = preferences.student_id
JOIN public.newsletter_subscribers subscriber
  ON subscriber.student_id = student.id
 AND subscriber.auth_user_id = student.user_id
LEFT JOIN public.ucat_email_program_assignments assignment
  ON assignment.student_id = student.id
LEFT JOIN LATERAL (
  SELECT
    subscription.created_at AS started_at,
    subscription.billing_interval
  FROM public.student_subscriptions subscription
  WHERE subscription.student_id = student.id
    AND subscription.subject_id = public.get_ucat_subject_id()
    AND subscription.plan_tier = 'unlimited'
    AND subscription.status IN ('active', 'past_due')
  ORDER BY subscription.created_at DESC
  LIMIT 1
) subscription ON TRUE
LEFT JOIN public.ucat_student_study_plan_profiles plan
  ON plan.student_id = student.id
 AND plan.setup_completed_at IS NOT NULL
LEFT JOIN LATERAL (
  SELECT step.title, step.launch_path
  FROM public.ucat_student_next_steps step
  WHERE step.student_id = student.id AND step.position = 1
  LIMIT 1
) next_step ON TRUE
LEFT JOIN LATERAL (
  SELECT
    current_snapshot.current_estimate,
    first_snapshot.first_estimate_generated_at,
    previous_snapshot.current_estimate AS previous_week_estimate
  FROM (
    SELECT snapshot.current_estimate
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
    ORDER BY snapshot.generated_at DESC
    LIMIT 1
  ) current_snapshot
  CROSS JOIN LATERAL (
    SELECT MIN(snapshot.generated_at) AS first_estimate_generated_at
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
  ) first_snapshot
  LEFT JOIN LATERAL (
    SELECT snapshot.current_estimate
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
      AND snapshot.snapshot_date <= CURRENT_DATE - 7
    ORDER BY snapshot.snapshot_date DESC
    LIMIT 1
  ) previous_snapshot ON TRUE
) projection ON TRUE
LEFT JOIN LATERAL (
  SELECT
    MAX(point.occurred_at) AS last_activity_at,
    COUNT(*) FILTER (
      WHERE point.kind = 'question'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS questions_last_7_days,
    COUNT(*) FILTER (
      WHERE point.kind = 'set'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS sets_last_7_days,
    COUNT(*) FILTER (
      WHERE point.kind = 'mock'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS mocks_last_7_days,
    COUNT(DISTINCT (point.occurred_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE)
      FILTER (WHERE point.occurred_at >= NOW() - INTERVAL '7 days')::INTEGER
      AS active_days_last_7_days,
    COUNT(DISTINCT (point.occurred_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE)
      FILTER (WHERE point.occurred_at >= NOW() - INTERVAL '14 days')::INTEGER
      AS active_days_last_14_days
  FROM (
    SELECT question_attempt.attempted_at AS occurred_at, 'question'::TEXT AS kind
    FROM public.student_question_attempts question_attempt
    LEFT JOIN public.student_question_set_attempts parent_set
      ON parent_set.id = question_attempt.student_question_set_attempt_id
    LEFT JOIN public.student_practice_sessions parent_practice
      ON parent_practice.id = question_attempt.student_practice_session_id
    WHERE question_attempt.student_id = student.id
      AND question_attempt.is_submitted = TRUE
      AND (
        question_attempt.student_question_set_attempt_id IS NULL
        OR parent_set.discarded_at IS NULL
      )
      AND (
        question_attempt.student_practice_session_id IS NULL
        OR parent_practice.discarded_at IS NULL
      )
    UNION ALL
    SELECT completed_at, 'set'::TEXT
    FROM public.student_question_set_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
    UNION ALL
    SELECT completed_at, 'mock'::TEXT
    FROM public.student_ucat_mock_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
    UNION ALL
    SELECT completed_at, 'trainer'::TEXT
    FROM public.student_skill_trainer_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
  ) point
) activity ON TRUE
CROSS JOIN LATERAL (
  SELECT subscription_config.min_questions_per_day,
         subscription_config.currency
  FROM public.ucat_subscription_config subscription_config
  LIMIT 1
) config
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER AS qualifying_days_last_7_days
  FROM (
    SELECT
      (attempt.attempted_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE
        AS practice_date
    FROM public.student_question_attempts attempt
    LEFT JOIN public.student_question_set_attempts parent_set
      ON parent_set.id = attempt.student_question_set_attempt_id
    LEFT JOIN public.student_practice_sessions parent_practice
      ON parent_practice.id = attempt.student_practice_session_id
    WHERE attempt.student_id = student.id
      AND attempt.is_submitted = TRUE
      AND (
        attempt.student_question_set_attempt_id IS NULL
        OR parent_set.discarded_at IS NULL
      )
      AND (
        attempt.student_practice_session_id IS NULL
        OR parent_practice.discarded_at IS NULL
      )
      AND attempt.attempted_at >= NOW() - INTERVAL '7 days'
    GROUP BY practice_date
    HAVING COUNT(*) >= config.min_questions_per_day
  ) qualifying_day
) consistency ON TRUE
LEFT JOIN LATERAL (
  SELECT
    price.base_price_cents AS monthly_base_price_cents,
    discount.discount_per_day_cents AS monthly_discount_per_day_cents,
    discount.max_discounts_per_period AS monthly_max_discount_days
  FROM public.ucat_plan_prices price
  JOIN public.ucat_practice_day_discount_config discount
    ON discount.billing_interval = price.billing_interval
  WHERE price.plan_tier = 'unlimited'
    AND price.billing_interval = 'month'
  LIMIT 1
) pricing ON TRUE
LEFT JOIN LATERAL (
  SELECT
    notification.created_at AS last_quota_reached_at,
    notification.metadata ->> 'quota_area' AS last_quota_area
  FROM public.notifications notification
  WHERE notification.student_id = student.id
    AND notification.notification_type = 'ucat.quota.limit_reached'
  ORDER BY notification.created_at DESC NULLS LAST
  LIMIT 1
) quota ON TRUE
LEFT JOIN LATERAL (
  SELECT (
    EXISTS (
      SELECT 1 FROM public.ucat_referrals referral
      WHERE referral.referrer_student_id = student.id
        AND referral.gift_status IN ('pending', 'checkout_pending')
    )
    OR EXISTS (
      SELECT 1 FROM public.ucat_referral_bill_rewards reward
      WHERE reward.student_id = student.id
        AND reward.status IN ('queued', 'applied')
    )
  ) AS has_open_referral_or_reward
) referral ON TRUE
LEFT JOIN LATERAL (
  SELECT
    MAX(ledger.sent_at) FILTER (WHERE ledger.status = 'sent')
      AS last_optional_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key = 'gentle_restart'
    ) AS last_restart_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key IN ('upgrade_quota', 'upgrade_consistency')
    ) AS last_upgrade_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key = 'referral_invitation'
    ) AS last_referral_sent_at,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_starting_point')
      AS sent_onboarding_starting_point,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_technique')
      AS sent_onboarding_technique,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_timing')
      AS sent_onboarding_timing,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_plan')
      AS sent_onboarding_plan,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'first_score_estimate')
      AS sent_first_score_estimate
  FROM public.ucat_email_delivery_ledger ledger
  WHERE ledger.student_id = student.id
) delivery ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.ucat_email_suppressions suppression
  WHERE suppression.email = LOWER(TRIM(student.email))
    AND suppression.active = TRUE
);

REVOKE ALL ON public.vinternal_ucat_lifecycle_email_candidates
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vinternal_ucat_lifecycle_email_candidates TO service_role;

COMMENT ON VIEW public.vinternal_ucat_lifecycle_email_candidates IS
  'Service-only, paginated evidence for greenfield UCAT optional-email eligibility. Never expose through a student client.';

CREATE VIEW public.vinternal_ucat_email_campaign_metrics
WITH (security_invoker = TRUE)
AS
SELECT
  control.campaign_key,
  control.display_name,
  control.topic,
  control.enabled,
  control.priority,
  control.cooldown_days,
  control.updated_at,
  COUNT(DISTINCT ledger.id) FILTER (
    WHERE ledger.created_at >= NOW() - INTERVAL '30 days'
  )::INTEGER AS attempts_last_30_days,
  COUNT(DISTINCT ledger.id) FILTER (
    WHERE ledger.status = 'sent'
      AND ledger.sent_at >= NOW() - INTERVAL '30 days'
  )::INTEGER AS sent_last_30_days,
  COUNT(DISTINCT ledger.id) FILTER (
    WHERE ledger.delivery_status = 'delivered'
      AND ledger.delivered_at >= NOW() - INTERVAL '30 days'
  )::INTEGER AS delivered_last_30_days,
  COUNT(DISTINCT ledger.id) FILTER (
    WHERE ledger.status IN ('failed', 'suppressed')
      AND ledger.updated_at >= NOW() - INTERVAL '30 days'
  )::INTEGER AS failed_or_suppressed_last_30_days,
  COUNT(DISTINCT event.ledger_id) FILTER (
    WHERE event.event_type = 'email.clicked'
      AND event.occurred_at >= NOW() - INTERVAL '30 days'
  )::INTEGER AS clicked_last_30_days,
  MAX(ledger.sent_at) AS last_sent_at
FROM public.ucat_email_campaign_controls control
LEFT JOIN public.ucat_email_delivery_ledger ledger
  ON ledger.campaign_key = control.campaign_key
LEFT JOIN public.ucat_email_delivery_events event
  ON event.ledger_id = ledger.id
GROUP BY
  control.campaign_key,
  control.display_name,
  control.topic,
  control.enabled,
  control.priority,
  control.cooldown_days,
  control.updated_at;

REVOKE ALL ON public.vinternal_ucat_email_campaign_metrics
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vinternal_ucat_email_campaign_metrics TO service_role;

COMMENT ON VIEW public.vinternal_ucat_email_campaign_metrics IS
  'Service-only operational campaign summary for admin-web; PostHog remains the effectiveness-analysis surface.';

-- Keep the Resend Contacts/Topics projection fresh for product-news
-- broadcasts. Supabase remains the source of truth for consent.
DO $block$
DECLARE
  jobid BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping UCAT Resend contact sync: pg_cron or pg_net unavailable.';
    RETURN;
  END IF;
  IF public.get_supabase_url() IS NULL
     OR public.get_ucat_lifecycle_cron_secret() IS NULL THEN
    RAISE NOTICE 'Skipping UCAT Resend contact sync: project URL or lifecycle secret is unavailable.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'ucat-resend-contact-sync';

  PERFORM cron.schedule(
    'ucat-resend-contact-sync',
    '37 * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/ucat-resend-contact-sync',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_ucat_lifecycle_cron_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END;
$block$;
