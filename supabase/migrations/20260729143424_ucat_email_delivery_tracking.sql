-- Durable Resend delivery and engagement events for UCAT email.
--
-- The webhook stores only a one-way recipient hash in the event stream. A
-- normalized address is retained only when Resend has told us to suppress it,
-- because lifecycle eligibility must be able to exclude that address.

ALTER TABLE public.ucat_email_delivery_ledger
  ADD COLUMN delivery_status TEXT,
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN last_provider_event_at TIMESTAMPTZ,
  ADD COLUMN provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD CONSTRAINT ucat_email_delivery_ledger_delivery_status_check
    CHECK (delivery_status IS NULL OR delivery_status IN (
      'accepted',
      'delivered',
      'delayed',
      'bounced',
      'complained',
      'suppressed',
      'failed'
    )),
  ADD CONSTRAINT ucat_email_delivery_ledger_provider_metadata_object
    CHECK (jsonb_typeof(provider_metadata) = 'object');

CREATE UNIQUE INDEX ucat_email_delivery_ledger_provider_message_key
  ON public.ucat_email_delivery_ledger(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE public.ucat_email_delivery_events (
  provider_event_id TEXT PRIMARY KEY CHECK (TRIM(provider_event_id) <> ''),
  provider_message_id TEXT NOT NULL CHECK (TRIM(provider_message_id) <> ''),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'email.delivered',
    'email.delivery_delayed',
    'email.failed',
    'email.bounced',
    'email.complained',
    'email.suppressed',
    'email.clicked',
    'email.opened'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email_hash TEXT,
  ledger_id UUID REFERENCES public.ucat_email_delivery_ledger(id) ON DELETE SET NULL,
  campaign_key TEXT,
  payload_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT ucat_email_delivery_events_recipient_hash
    CHECK (recipient_email_hash IS NULL OR recipient_email_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ucat_email_delivery_events_payload_metadata_object
    CHECK (jsonb_typeof(payload_metadata) = 'object')
);

CREATE INDEX ucat_email_delivery_events_message_time_idx
  ON public.ucat_email_delivery_events(provider_message_id, occurred_at DESC);
CREATE INDEX ucat_email_delivery_events_campaign_time_idx
  ON public.ucat_email_delivery_events(campaign_key, occurred_at DESC)
  WHERE campaign_key IS NOT NULL;
CREATE INDEX ucat_email_delivery_events_type_time_idx
  ON public.ucat_email_delivery_events(event_type, occurred_at DESC);

ALTER TABLE public.ucat_email_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_email_delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ucat_email_delivery_events TO service_role;

COMMENT ON TABLE public.ucat_email_delivery_events IS
  'Idempotent, privacy-minimized Resend event stream. provider_event_id is the signed svix-id header.';

CREATE TABLE public.ucat_email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('bounced', 'complained', 'suppressed')),
  source TEXT NOT NULL DEFAULT 'resend' CHECK (TRIM(source) <> ''),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_suppressed_at TIMESTAMPTZ NOT NULL,
  last_suppressed_at TIMESTAMPTZ NOT NULL,
  last_provider_event_id TEXT NOT NULL CHECK (TRIM(last_provider_event_id) <> ''),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_email_suppressions_email_normalized
    CHECK (email = LOWER(TRIM(email)) AND LENGTH(email) BETWEEN 3 AND 320),
  CONSTRAINT ucat_email_suppressions_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ucat_email_suppressions_active_email_idx
  ON public.ucat_email_suppressions(email)
  WHERE active = TRUE;

CREATE TRIGGER update_ucat_email_suppressions_updated_at
  BEFORE UPDATE ON public.ucat_email_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ucat_email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_email_suppressions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ucat_email_suppressions TO service_role;

COMMENT ON TABLE public.ucat_email_suppressions IS
  'Addresses excluded from UCAT lifecycle/marketing delivery after a permanent Resend bounce, complaint, or provider suppression.';

-- Apply a provider event without allowing late or lower-priority events to
-- undo a permanent failure. Opens and clicks live in the event stream and do
-- not overwrite delivery state.
CREATE OR REPLACE FUNCTION public.apply_ucat_email_event_to_ledger(
  p_ledger_id UUID,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_occurred_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  next_delivery_status TEXT;
BEGIN
  next_delivery_status := CASE p_event_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.delivery_delayed' THEN 'delayed'
    WHEN 'email.failed' THEN 'failed'
    WHEN 'email.bounced' THEN 'bounced'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.suppressed' THEN 'suppressed'
    ELSE NULL
  END;

  UPDATE public.ucat_email_delivery_ledger ledger
  SET
    status = CASE
      WHEN p_event_type IN ('email.bounced', 'email.complained', 'email.suppressed')
        THEN 'suppressed'
      ELSE ledger.status
    END,
    delivery_status = CASE
      WHEN p_event_type IN ('email.bounced', 'email.complained', 'email.suppressed')
        THEN next_delivery_status
      WHEN ledger.delivery_status IN ('bounced', 'complained', 'suppressed')
        THEN ledger.delivery_status
      WHEN p_event_type = 'email.failed' THEN 'failed'
      WHEN ledger.delivery_status = 'failed' THEN ledger.delivery_status
      WHEN p_event_type = 'email.delivered' THEN 'delivered'
      WHEN p_event_type = 'email.delivery_delayed'
        AND ledger.delivery_status IS DISTINCT FROM 'delivered' THEN 'delayed'
      ELSE COALESCE(ledger.delivery_status, 'accepted')
    END,
    delivered_at = CASE
      WHEN p_event_type = 'email.delivered'
        THEN COALESCE(ledger.delivered_at, p_occurred_at)
      ELSE ledger.delivered_at
    END,
    last_provider_event_at = GREATEST(
      COALESCE(ledger.last_provider_event_at, '-infinity'::TIMESTAMPTZ),
      p_occurred_at
    ),
    provider_metadata = CASE
      WHEN ledger.last_provider_event_at IS NULL
        OR p_occurred_at >= ledger.last_provider_event_at
      THEN ledger.provider_metadata || jsonb_build_object(
        'last_event_id', p_provider_event_id,
        'last_event_type', p_event_type,
        'last_event_at', p_occurred_at
      )
      ELSE ledger.provider_metadata
    END
  WHERE ledger.id = p_ledger_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_ucat_email_event_to_ledger(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ucat_email_event_to_ledger(UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- Records an event and applies its side effects in one transaction. Duplicate
-- webhook deliveries become a no-op through provider_event_id uniqueness.
CREATE OR REPLACE FUNCTION public.record_ucat_resend_email_event(
  p_provider_event_id TEXT,
  p_provider_message_id TEXT,
  p_event_type TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_recipient_email TEXT DEFAULT NULL,
  p_payload_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  inserted BOOLEAN,
  ledger_id UUID,
  auth_user_id UUID,
  campaign_key TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  normalized_email TEXT := NULLIF(LOWER(TRIM(p_recipient_email)), '');
  matched_ledger_id UUID;
  matched_auth_user_id UUID;
  matched_campaign_key TEXT;
  inserted_event_id TEXT;
  mapped_delivery_status TEXT;
BEGIN
  IF NULLIF(TRIM(p_provider_event_id), '') IS NULL
     OR NULLIF(TRIM(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'Provider event and message IDs are required';
  END IF;
  IF p_event_type NOT IN (
    'email.delivered',
    'email.delivery_delayed',
    'email.failed',
    'email.bounced',
    'email.complained',
    'email.suppressed',
    'email.clicked',
    'email.opened'
  ) THEN
    RAISE EXCEPTION 'Unsupported Resend event type: %', p_event_type;
  END IF;
  IF p_occurred_at IS NULL THEN
    RAISE EXCEPTION 'Provider event timestamp is required';
  END IF;
  IF normalized_email IS NOT NULL AND LENGTH(normalized_email) NOT BETWEEN 3 AND 320 THEN
    normalized_email := NULL;
  END IF;
  IF COALESCE(jsonb_typeof(p_payload_metadata), 'null') <> 'object' THEN
    RAISE EXCEPTION 'Payload metadata must be a JSON object';
  END IF;

  SELECT ledger.id, student.user_id, ledger.campaign_key
  INTO matched_ledger_id, matched_auth_user_id, matched_campaign_key
  FROM public.ucat_email_delivery_ledger ledger
  JOIN public.students student ON student.id = ledger.student_id
  WHERE ledger.provider_message_id = p_provider_message_id
  LIMIT 1;

  INSERT INTO public.ucat_email_delivery_events (
    provider_event_id,
    provider_message_id,
    event_type,
    occurred_at,
    recipient_email_hash,
    ledger_id,
    campaign_key,
    payload_metadata
  ) VALUES (
    TRIM(p_provider_event_id),
    TRIM(p_provider_message_id),
    p_event_type,
    p_occurred_at,
    CASE WHEN normalized_email IS NULL THEN NULL
      ELSE ENCODE(extensions.digest(normalized_email, 'sha256'), 'hex') END,
    matched_ledger_id,
    matched_campaign_key,
    COALESCE(p_payload_metadata, '{}'::JSONB)
  )
  ON CONFLICT (provider_event_id) DO NOTHING
  RETURNING provider_event_id INTO inserted_event_id;

  IF inserted_event_id IS NULL THEN
    SELECT event.ledger_id, student.user_id, event.campaign_key
    INTO matched_ledger_id, matched_auth_user_id, matched_campaign_key
    FROM public.ucat_email_delivery_events event
    LEFT JOIN public.ucat_email_delivery_ledger ledger ON ledger.id = event.ledger_id
    LEFT JOIN public.students student ON student.id = ledger.student_id
    WHERE event.provider_event_id = TRIM(p_provider_event_id);

    RETURN QUERY SELECT FALSE, matched_ledger_id, matched_auth_user_id, matched_campaign_key;
    RETURN;
  END IF;

  IF normalized_email IS NOT NULL
     AND p_event_type IN ('email.bounced', 'email.complained', 'email.suppressed') THEN
    INSERT INTO public.ucat_email_suppressions (
      email,
      reason,
      source,
      active,
      first_suppressed_at,
      last_suppressed_at,
      last_provider_event_id
    ) VALUES (
      normalized_email,
      REPLACE(p_event_type, 'email.', ''),
      'resend',
      TRUE,
      p_occurred_at,
      p_occurred_at,
      TRIM(p_provider_event_id)
    )
    ON CONFLICT (email) DO UPDATE SET
      reason = EXCLUDED.reason,
      source = EXCLUDED.source,
      active = TRUE,
      first_suppressed_at = LEAST(
        public.ucat_email_suppressions.first_suppressed_at,
        EXCLUDED.first_suppressed_at
      ),
      last_suppressed_at = GREATEST(
        public.ucat_email_suppressions.last_suppressed_at,
        EXCLUDED.last_suppressed_at
      ),
      last_provider_event_id = CASE
        WHEN EXCLUDED.last_suppressed_at >= public.ucat_email_suppressions.last_suppressed_at
          THEN EXCLUDED.last_provider_event_id
        ELSE public.ucat_email_suppressions.last_provider_event_id
      END;
  END IF;

  IF matched_ledger_id IS NOT NULL THEN
    PERFORM public.apply_ucat_email_event_to_ledger(
      matched_ledger_id,
      TRIM(p_provider_event_id),
      p_event_type,
      p_occurred_at
    );
  END IF;

  mapped_delivery_status := CASE p_event_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.delivery_delayed' THEN 'delayed'
    WHEN 'email.failed' THEN 'failed'
    WHEN 'email.bounced' THEN 'bounced'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.suppressed' THEN 'suppressed'
    ELSE NULL
  END;

  -- The transactional outbox is introduced by the following migration. Use a
  -- runtime relation check so this migration remains independently reversible.
  IF mapped_delivery_status IS NOT NULL
     AND TO_REGCLASS('public.ucat_transactional_email_outbox') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.ucat_transactional_email_outbox outbox
      SET
        delivery_status = CASE
          WHEN $2 IN ('bounced', 'complained', 'suppressed') THEN $2
          WHEN outbox.delivery_status IN ('bounced', 'complained', 'suppressed')
            THEN outbox.delivery_status
          WHEN $2 = 'failed' THEN 'failed'
          WHEN outbox.delivery_status = 'failed' THEN outbox.delivery_status
          WHEN $2 = 'delivered' THEN 'delivered'
          WHEN $2 = 'delayed' AND outbox.delivery_status IS DISTINCT FROM 'delivered'
            THEN 'delayed'
          ELSE outbox.delivery_status
        END,
        delivered_at = CASE
          WHEN $2 = 'delivered' THEN COALESCE(outbox.delivered_at, $3)
          ELSE outbox.delivered_at
        END
      WHERE outbox.provider_message_id = $1
    $sql$ USING TRIM(p_provider_message_id), mapped_delivery_status, p_occurred_at;
  END IF;

  RETURN QUERY SELECT TRUE, matched_ledger_id, matched_auth_user_id, matched_campaign_key;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_ucat_resend_email_event(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ucat_resend_email_event(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) TO service_role;

-- A delivery webhook can race the API response that stores provider_message_id.
-- Link and apply any already-recorded events when the ledger catches up.
CREATE OR REPLACE FUNCTION public.link_ucat_email_events_after_ledger_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  provider_event RECORD;
BEGIN
  IF NEW.provider_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.ucat_email_delivery_events event
  SET ledger_id = NEW.id,
      campaign_key = NEW.campaign_key
  WHERE event.provider_message_id = NEW.provider_message_id
    AND event.ledger_id IS NULL;

  UPDATE public.ucat_email_delivery_ledger
  SET delivery_status = COALESCE(delivery_status, 'accepted')
  WHERE id = NEW.id;

  FOR provider_event IN
    SELECT event.provider_event_id, event.event_type, event.occurred_at
    FROM public.ucat_email_delivery_events event
    WHERE event.provider_message_id = NEW.provider_message_id
    ORDER BY event.occurred_at, event.provider_event_id
  LOOP
    PERFORM public.apply_ucat_email_event_to_ledger(
      NEW.id,
      provider_event.provider_event_id,
      provider_event.event_type,
      provider_event.occurred_at
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_ucat_email_events_after_ledger_update()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER link_ucat_email_events_after_ledger_update
  AFTER INSERT OR UPDATE OF provider_message_id ON public.ucat_email_delivery_ledger
  FOR EACH ROW
  WHEN (NEW.provider_message_id IS NOT NULL)
  EXECUTE FUNCTION public.link_ucat_email_events_after_ledger_update();

-- Preserve the service-only candidate contract while excluding active provider
-- suppressions before a campaign is claimed.
CREATE OR REPLACE VIEW public.vinternal_ucat_lifecycle_email_candidates
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
    GREATEST(question.last_at, set_attempt.last_at, mock.last_at, trainer.last_at) AS last_activity_at,
    COALESCE(question.week_count, 0)::INTEGER AS questions_last_7_days,
    COALESCE(set_attempt.week_count, 0)::INTEGER AS sets_last_7_days,
    COALESCE(mock.week_count, 0)::INTEGER AS mocks_last_7_days
  FROM (
    SELECT MAX(attempted_at) AS last_at,
      COUNT(*) FILTER (WHERE attempted_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_question_attempts
    WHERE student_id = student.id AND is_submitted = TRUE
  ) question
  CROSS JOIN (
    SELECT MAX(completed_at) AS last_at,
      COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_question_set_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) set_attempt
  CROSS JOIN (
    SELECT MAX(completed_at) AS last_at,
      COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days') AS week_count
    FROM public.student_ucat_mock_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) mock
  CROSS JOIN (
    SELECT MAX(completed_at) AS last_at
    FROM public.student_skill_trainer_attempts
    WHERE student_id = student.id AND completed_at IS NOT NULL
  ) trainer
) activity ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ucat_email_suppressions suppression
  WHERE suppression.email = LOWER(TRIM(student.email))
    AND suppression.active = TRUE
);

REVOKE ALL ON public.vinternal_ucat_lifecycle_email_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vinternal_ucat_lifecycle_email_candidates TO service_role;

COMMENT ON VIEW public.vinternal_ucat_lifecycle_email_candidates IS
  'Service-only lifecycle eligibility evidence, excluding active provider suppressions. Never expose through a student client.';
