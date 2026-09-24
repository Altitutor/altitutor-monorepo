-- UCAT lifecycle communication preferences, consent evidence and delivery
-- idempotency. Delivery remains disabled until the Edge Function environment
-- explicitly sets UCAT_LIFECYCLE_EMAILS_ENABLED=true.

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_wording TEXT,
  ADD COLUMN IF NOT EXISTS consent_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_auth_user_id_key
  ON public.newsletter_subscribers(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.newsletter_subscribers.consent_verified_at IS
  'Time consent was recorded after Supabase verified the email-owning account. NULL legacy rows are not lifecycle-send eligible.';

CREATE TABLE public.ucat_communication_preferences (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  weekly_progress_and_guidance BOOLEAN NOT NULL DEFAULT FALSE,
  lessons_and_tips BOOLEAN NOT NULL DEFAULT FALSE,
  product_news BOOLEAN NOT NULL DEFAULT FALSE,
  offers_and_referrals BOOLEAN NOT NULL DEFAULT FALSE,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_ucat_communication_preferences_updated_at
  BEFORE UPDATE ON public.ucat_communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ucat_communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own UCAT communication preferences"
  ON public.ucat_communication_preferences
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

-- Preference writes go through the authenticated server route so each change
-- can be paired with an immutable consent event.
REVOKE ALL ON public.ucat_communication_preferences FROM anon, authenticated;
GRANT SELECT ON public.ucat_communication_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ucat_communication_preferences TO service_role;

CREATE TABLE public.ucat_communication_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN (
    'all_marketing',
    'weekly_progress_and_guidance',
    'lessons_and_tips',
    'product_news',
    'offers_and_referrals'
  )),
  action TEXT NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  source TEXT NOT NULL CHECK (TRIM(source) <> ''),
  wording_version TEXT NOT NULL CHECK (TRIM(wording_version) <> ''),
  wording TEXT NOT NULL CHECK (TRIM(wording) <> ''),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT ucat_communication_consent_events_email_normalized
    CHECK (email = LOWER(TRIM(email))),
  CONSTRAINT ucat_communication_consent_events_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ucat_communication_consent_events_user_time_idx
  ON public.ucat_communication_consent_events(auth_user_id, occurred_at DESC);
CREATE INDEX ucat_communication_consent_events_student_time_idx
  ON public.ucat_communication_consent_events(student_id, occurred_at DESC)
  WHERE student_id IS NOT NULL;

ALTER TABLE public.ucat_communication_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_communication_consent_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.ucat_communication_consent_events TO service_role;

COMMENT ON TABLE public.ucat_communication_consent_events IS
  'Immutable evidence of UCAT marketing consent grants and withdrawals. Application code must not update or delete rows.';

CREATE OR REPLACE FUNCTION public.set_ucat_communication_preferences(
  p_auth_user_id UUID,
  p_student_id UUID,
  p_email TEXT,
  p_weekly_progress_and_guidance BOOLEAN,
  p_lessons_and_tips BOOLEAN,
  p_product_news BOOLEAN,
  p_offers_and_referrals BOOLEAN,
  p_source TEXT,
  p_wording_version TEXT,
  p_wording TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  previous public.ucat_communication_preferences%ROWTYPE;
  next_values JSONB;
  old_values JSONB;
  topic TEXT;
  next_value BOOLEAN;
  old_value BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = p_student_id AND user_id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION 'Student does not belong to authenticated user';
  END IF;

  SELECT * INTO previous
  FROM public.ucat_communication_preferences
  WHERE student_id = p_student_id;

  old_values := jsonb_build_object(
    'weekly_progress_and_guidance', COALESCE(previous.weekly_progress_and_guidance, FALSE),
    'lessons_and_tips', COALESCE(previous.lessons_and_tips, FALSE),
    'product_news', COALESCE(previous.product_news, FALSE),
    'offers_and_referrals', COALESCE(previous.offers_and_referrals, FALSE)
  );
  next_values := jsonb_build_object(
    'weekly_progress_and_guidance', p_weekly_progress_and_guidance,
    'lessons_and_tips', p_lessons_and_tips,
    'product_news', p_product_news,
    'offers_and_referrals', p_offers_and_referrals
  );

  INSERT INTO public.ucat_communication_preferences (
    student_id,
    weekly_progress_and_guidance,
    lessons_and_tips,
    product_news,
    offers_and_referrals
  ) VALUES (
    p_student_id,
    p_weekly_progress_and_guidance,
    p_lessons_and_tips,
    p_product_news,
    p_offers_and_referrals
  )
  ON CONFLICT (student_id) DO UPDATE SET
    weekly_progress_and_guidance = EXCLUDED.weekly_progress_and_guidance,
    lessons_and_tips = EXCLUDED.lessons_and_tips,
    product_news = EXCLUDED.product_news,
    offers_and_referrals = EXCLUDED.offers_and_referrals,
    updated_at = NOW();

  FOREACH topic IN ARRAY ARRAY[
    'weekly_progress_and_guidance',
    'lessons_and_tips',
    'product_news',
    'offers_and_referrals'
  ] LOOP
    old_value := (old_values ->> topic)::BOOLEAN;
    next_value := (next_values ->> topic)::BOOLEAN;
    IF old_value IS DISTINCT FROM next_value THEN
      INSERT INTO public.ucat_communication_consent_events (
        auth_user_id, student_id, email, topic, action, source,
        wording_version, wording
      ) VALUES (
        p_auth_user_id, p_student_id, LOWER(TRIM(p_email)), topic,
        CASE WHEN next_value THEN 'granted' ELSE 'withdrawn' END,
        p_source, p_wording_version, p_wording
      );
    END IF;
  END LOOP;

  UPDATE public.newsletter_subscribers SET
    student_id = p_student_id,
    auth_user_id = p_auth_user_id,
    unsubscribed_at = CASE
      WHEN p_weekly_progress_and_guidance OR p_lessons_and_tips
        OR p_product_news OR p_offers_and_referrals THEN NULL
      ELSE NOW()
    END,
    resend_audience_synced_at = NULL,
    updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id OR email = LOWER(TRIM(p_email));
END;
$function$;

REVOKE ALL ON FUNCTION public.set_ucat_communication_preferences(
  UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ucat_communication_preferences(
  UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT
) TO service_role;

CREATE TABLE public.ucat_email_delivery_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  campaign_key TEXT NOT NULL CHECK (TRIM(campaign_key) <> ''),
  topic TEXT NOT NULL CHECK (topic IN (
    'weekly_progress_and_guidance',
    'lessons_and_tips',
    'product_news',
    'offers_and_referrals'
  )),
  dedupe_key TEXT NOT NULL UNIQUE CHECK (TRIM(dedupe_key) <> ''),
  status TEXT NOT NULL CHECK (status IN (
    'processing', 'sent', 'failed', 'suppressed', 'dry_run'
  )),
  attempt_count SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  provider_message_id TEXT,
  last_error TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_email_delivery_ledger_email_normalized
    CHECK (recipient_email = LOWER(TRIM(recipient_email))),
  CONSTRAINT ucat_email_delivery_ledger_evidence_object
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT ucat_email_delivery_ledger_sent_state
    CHECK ((status = 'sent' AND sent_at IS NOT NULL) OR status <> 'sent')
);

CREATE INDEX ucat_email_delivery_ledger_student_created_idx
  ON public.ucat_email_delivery_ledger(student_id, created_at DESC);
CREATE INDEX ucat_email_delivery_ledger_status_updated_idx
  ON public.ucat_email_delivery_ledger(status, updated_at);

CREATE TRIGGER update_ucat_email_delivery_ledger_updated_at
  BEFORE UPDATE ON public.ucat_email_delivery_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ucat_email_delivery_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_email_delivery_ledger FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ucat_email_delivery_ledger TO service_role;

CREATE INDEX IF NOT EXISTS student_question_attempts_lifecycle_activity_idx
  ON public.student_question_attempts(student_id, attempted_at DESC)
  WHERE is_submitted = TRUE;
CREATE INDEX IF NOT EXISTS student_question_set_attempts_lifecycle_activity_idx
  ON public.student_question_set_attempts(student_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS student_ucat_mock_attempts_lifecycle_activity_idx
  ON public.student_ucat_mock_attempts(student_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS student_skill_trainer_attempts_lifecycle_activity_idx
  ON public.student_skill_trainer_attempts(student_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE VIEW public.vinternal_ucat_lifecycle_email_candidates
WITH (security_invoker = TRUE)
AS
SELECT
  preferences.student_id,
  student.user_id AS auth_user_id,
  LOWER(TRIM(student.email)) AS email,
  student.first_name,
  student.timezone,
  student.status,
  student.ucat_signup_completed_at,
  preferences.weekly_progress_and_guidance,
  preferences.lessons_and_tips,
  preferences.product_news,
  preferences.offers_and_referrals,
  preferences.unsubscribe_token,
  subscriber.consent_verified_at,
  subscriber.unsubscribed_at,
  activity.last_activity_at,
  activity.questions_last_7_days,
  activity.sets_last_7_days,
  activity.mocks_last_7_days,
  (plan.student_id IS NOT NULL) AS has_study_plan,
  next_step.title AS next_step_title,
  next_step.launch_path AS next_step_path,
  projection.current_estimate,
  projection.confidence AS score_confidence
FROM public.ucat_communication_preferences preferences
JOIN public.students student ON student.id = preferences.student_id
JOIN public.newsletter_subscribers subscriber
  ON subscriber.student_id = student.id
 AND subscriber.auth_user_id = student.user_id
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
  SELECT snapshot.current_estimate, snapshot.confidence
  FROM public.ucat_score_projection_snapshots snapshot
  WHERE snapshot.student_id = student.id
  ORDER BY snapshot.snapshot_date DESC
  LIMIT 1
) projection ON TRUE
LEFT JOIN LATERAL (
  SELECT
    GREATEST(
      question.last_at,
      set_attempt.last_at,
      mock.last_at,
      trainer.last_at
    ) AS last_activity_at,
    COALESCE(question.week_count, 0)::INTEGER AS questions_last_7_days,
    COALESCE(set_attempt.week_count, 0)::INTEGER AS sets_last_7_days,
    COALESCE(mock.week_count, 0)::INTEGER AS mocks_last_7_days
  FROM (
    SELECT
      MAX(attempted_at) AS last_at,
      COUNT(*) FILTER (WHERE attempted_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_question_attempts
    WHERE student_id = student.id AND is_submitted = TRUE
  ) question
  CROSS JOIN (
    SELECT
      MAX(completed_at) AS last_at,
      COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_question_set_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) set_attempt
  CROSS JOIN (
    SELECT
      MAX(completed_at) AS last_at,
      COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_ucat_mock_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) mock
  CROSS JOIN (
    SELECT MAX(completed_at) AS last_at
    FROM public.student_skill_trainer_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) trainer
) activity ON TRUE;

REVOKE ALL ON public.vinternal_ucat_lifecycle_email_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vinternal_ucat_lifecycle_email_candidates TO service_role;

COMMENT ON VIEW public.vinternal_ucat_lifecycle_email_candidates IS
  'Service-only lifecycle eligibility evidence. Never expose through a student client.';

-- Atomically reserves a delivery key. Failed requests can retry at most three
-- times, no more frequently than every fifteen minutes.
CREATE OR REPLACE FUNCTION public.claim_ucat_lifecycle_email(
  p_student_id UUID,
  p_recipient_email TEXT,
  p_campaign_key TEXT,
  p_topic TEXT,
  p_dedupe_key TEXT,
  p_evidence JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(id UUID, attempt_count SMALLINT)
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $function$
  INSERT INTO public.ucat_email_delivery_ledger (
    student_id,
    recipient_email,
    campaign_key,
    topic,
    dedupe_key,
    status,
    evidence
  )
  VALUES (
    p_student_id,
    LOWER(TRIM(p_recipient_email)),
    p_campaign_key,
    p_topic,
    p_dedupe_key,
    'processing',
    COALESCE(p_evidence, '{}'::JSONB)
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'processing',
        attempt_count = public.ucat_email_delivery_ledger.attempt_count + 1,
        last_error = NULL,
        evidence = EXCLUDED.evidence,
        updated_at = NOW()
  WHERE public.ucat_email_delivery_ledger.status = 'failed'
    AND public.ucat_email_delivery_ledger.attempt_count < 3
    AND public.ucat_email_delivery_ledger.updated_at <= NOW() - INTERVAL '15 minutes'
  RETURNING
    public.ucat_email_delivery_ledger.id,
    public.ucat_email_delivery_ledger.attempt_count;
$function$;

REVOKE ALL ON FUNCTION public.claim_ucat_lifecycle_email(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ucat_lifecycle_email(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

-- A dedicated secret keeps the scheduler independently revocable. The helper
-- is postgres-only because cron job commands are visible in cron.job.
CREATE OR REPLACE FUNCTION public.get_ucat_lifecycle_cron_secret()
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
    WHERE name = 'ucat_lifecycle_cron_secret';
  EXCEPTION WHEN OTHERS THEN
    secret := NULL;
  END;
  RETURN NULLIF(secret, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ucat_lifecycle_cron_secret()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ucat_lifecycle_cron_secret() TO postgres;

-- Run hourly so each student's 09:00 local delivery window can be respected.
-- If either Vault secret is absent, no job is created. Even when scheduled,
-- the Edge Function remains a dry run unless its explicit enable flag is true.
DO $block$
DECLARE
  project_url TEXT;
  cron_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping UCAT lifecycle scheduler: pg_cron or pg_net unavailable.';
    RETURN;
  END IF;

  project_url := public.get_supabase_url();
  cron_secret := public.get_ucat_lifecycle_cron_secret();
  IF project_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'Skipping UCAT lifecycle scheduler: configure project_url and ucat_lifecycle_cron_secret in Vault.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'ucat-lifecycle-emails';

  PERFORM cron.schedule(
    'ucat-lifecycle-emails',
    '17 * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/ucat-lifecycle-emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_ucat_lifecycle_cron_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{"mode":"send"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END;
$block$;
