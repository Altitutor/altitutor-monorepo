-- Durable automation executions for immediate activity events and relative-time
-- session reminders. Rules keep their existing interface; executions provide
-- retry, idempotency and an operational audit trail behind that interface.

ALTER TABLE public.automation_rules
  ADD COLUMN trigger_kind TEXT NOT NULL DEFAULT 'EVENT',
  ADD COLUMN trigger_config JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_trigger_kind_check
    CHECK (trigger_kind IN ('EVENT', 'RELATIVE_TIME')),
  ADD CONSTRAINT automation_rules_trigger_config_object_check
    CHECK (jsonb_typeof(trigger_config) = 'object'),
  ADD CONSTRAINT automation_rules_relative_time_config_check
    CHECK (
      trigger_kind <> 'RELATIVE_TIME'
      OR (
        entity_type = 'sessions'
        AND trigger_config->>'anchor' = 'session.start_at'
        AND (trigger_config->>'offset_minutes') ~ '^[0-9]+$'
        AND (trigger_config->>'offset_minutes')::INTEGER BETWEEN 0 AND 525600
      )
    );

CREATE INDEX automation_rules_relative_time_idx
  ON public.automation_rules(enabled, entity_type)
  WHERE trigger_kind = 'RELATIVE_TIME' AND enabled = TRUE;

CREATE TABLE public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  activity_event_id UUID REFERENCES public.activity_events(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL UNIQUE CHECK (TRIM(source_key) <> ''),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED')
  ),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 8),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX automation_executions_dispatch_idx
  ON public.automation_executions(next_attempt_at, scheduled_for, created_at)
  WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');
CREATE INDEX automation_executions_rule_idx
  ON public.automation_executions(rule_id, created_at DESC);
CREATE INDEX automation_executions_activity_idx
  ON public.automation_executions(activity_event_id)
  WHERE activity_event_id IS NOT NULL;

CREATE TRIGGER set_updated_at_automation_executions
  BEFORE UPDATE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_executions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_executions TO service_role;
GRANT SELECT ON public.automation_executions TO authenticated;

CREATE POLICY "ADMINSTAFF can read automation executions"
  ON public.automation_executions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE TABLE public.automation_message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.automation_actions(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (
    status IN ('PROCESSING', 'QUEUED', 'FAILED', 'SKIPPED')
  ),
  attempt_count SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 8),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX automation_message_deliveries_target_unique
  ON public.automation_message_deliveries(
    execution_id,
    action_id,
    contact_id,
    COALESCE(student_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );
CREATE INDEX automation_message_deliveries_message_idx
  ON public.automation_message_deliveries(message_id)
  WHERE message_id IS NOT NULL;

CREATE TRIGGER set_updated_at_automation_message_deliveries
  BEFORE UPDATE ON public.automation_message_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.automation_message_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_message_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_message_deliveries TO service_role;
GRANT SELECT ON public.automation_message_deliveries TO authenticated;

CREATE POLICY "ADMINSTAFF can read automation message deliveries"
  ON public.automation_message_deliveries
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

COMMENT ON TABLE public.automation_executions IS
  'Durable, retryable and idempotent rule executions for activity and relative-time automations.';
COMMENT ON TABLE public.automation_message_deliveries IS
  'Per-recipient SMS delivery ledger. Student context prevents a parent with multiple students receiving the wrong registration link.';

CREATE OR REPLACE FUNCTION public.enqueue_automation_execution(
  p_rule_id UUID,
  p_activity_event_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_event_type TEXT,
  p_session_id UUID,
  p_source_key TEXT,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  execution_id UUID;
BEGIN
  INSERT INTO public.automation_executions (
    rule_id,
    activity_event_id,
    entity_type,
    entity_id,
    event_type,
    session_id,
    source_key,
    scheduled_for,
    next_attempt_at
  ) VALUES (
    p_rule_id,
    p_activity_event_id,
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_session_id,
    p_source_key,
    COALESCE(p_scheduled_for, NOW()),
    COALESCE(p_scheduled_for, NOW())
  )
  ON CONFLICT (source_key) DO NOTHING
  RETURNING id INTO execution_id;

  IF execution_id IS NULL THEN
    SELECT id INTO execution_id
    FROM public.automation_executions
    WHERE source_key = p_source_key;
  END IF;

  RETURN execution_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_automation_execution(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_automation_execution(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TIMESTAMPTZ
) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.claim_automation_execution(p_execution_id UUID)
RETURNS SETOF public.automation_executions
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $function$
  UPDATE public.automation_executions execution
  SET
    status = 'PROCESSING',
    attempt_count = execution.attempt_count + 1,
    claimed_at = NOW(),
    last_error = NULL,
    updated_at = NOW()
  WHERE execution.id = p_execution_id
    AND execution.attempt_count < 8
    AND execution.scheduled_for <= NOW()
    AND execution.next_attempt_at <= NOW()
    AND (
      execution.status IN ('PENDING', 'FAILED')
      OR (
        execution.status = 'PROCESSING'
        AND execution.claimed_at <= NOW() - INTERVAL '10 minutes'
      )
    )
  RETURNING execution.*;
$function$;

REVOKE ALL ON FUNCTION public.claim_automation_execution(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_execution(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.materialize_due_session_automation_executions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.automation_executions (
    rule_id,
    entity_type,
    entity_id,
    event_type,
    session_id,
    source_key,
    scheduled_for,
    next_attempt_at
  )
  SELECT
    rule.id,
    'sessions',
    session.id,
    'SCHEDULED',
    session.id,
    'scheduled:' || rule.id::TEXT || ':' || session.id::TEXT || ':' || session.start_at::TEXT,
    session.start_at - make_interval(
      mins => (rule.trigger_config->>'offset_minutes')::INTEGER
    ),
    NOW()
  FROM public.automation_rules rule
  JOIN public.sessions session
    ON session.status = 'ACTIVE'
   AND session.start_at > NOW()
  WHERE rule.enabled = TRUE
    AND rule.trigger_kind = 'RELATIVE_TIME'
    AND rule.entity_type = 'sessions'
    AND rule.trigger_config->>'anchor' = 'session.start_at'
    AND session.start_at - make_interval(
      mins => (rule.trigger_config->>'offset_minutes')::INTEGER
    ) <= NOW()
  ON CONFLICT (source_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.materialize_due_session_automation_executions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_due_session_automation_executions()
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.dispatch_due_automation_executions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  execution RECORD;
  dispatched_count INTEGER := 0;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  PERFORM public.materialize_due_session_automation_executions();

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN 0;
  END IF;

  supabase_url := public.get_supabase_url();
  service_key := public.get_service_role_key();
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN 0;
  END IF;

  FOR execution IN
    SELECT id
    FROM public.automation_executions
    WHERE attempt_count < 8
      AND scheduled_for <= NOW()
      AND next_attempt_at <= NOW()
      AND (
        status IN ('PENDING', 'FAILED')
        OR (status = 'PROCESSING' AND claimed_at <= NOW() - INTERVAL '10 minutes')
      )
    ORDER BY next_attempt_at, scheduled_for, created_at
    LIMIT 100
  LOOP
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/activity-processor',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('execution_id', execution.id),
      timeout_milliseconds := 5000
    );
    dispatched_count := dispatched_count + 1;
  END LOOP;

  RETURN dispatched_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_due_automation_executions()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_due_automation_executions() TO postgres;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Skipping automation execution dispatcher: pg_cron unavailable.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'automation-execution-dispatch';

  PERFORM cron.schedule(
    'automation-execution-dispatch',
    '* * * * *',
    'SELECT public.dispatch_due_automation_executions()'
  );
END;
$block$;

-- Make the relationship events available in the admin rule editor.
-- Existing activity triggers already emit these events.

DO $block$
DECLARE
  altitutor_sender_id UUID;
  v_rule_id UUID;
BEGIN
  SELECT id INTO altitutor_sender_id
  FROM public.owned_numbers
  WHERE sender_type = 'ALPHANUMERIC'
    AND alphanumeric_sender_id = 'ALTITUTOR'
  LIMIT 1;

  IF altitutor_sender_id IS NULL THEN
    RAISE EXCEPTION 'ALTITUTOR alphanumeric sender is required';
  END IF;

  -- A newly attached student is the canonical booking event. This also covers
  -- sessions created for a student without producing duplicate confirmations.
  INSERT INTO public.automation_rules (
    name, description, entity_type, event_types, conditions, enabled, priority,
    trigger_kind, trigger_config
  ) VALUES (
    'Confirm trial or subsidy session attendance',
    'Texts a student and all parents when the student is attached to a trial session or subsidy interview.',
    'sessions_students', ARRAY['CREATED']::TEXT[],
    jsonb_build_object(
      'all', jsonb_build_array(
        jsonb_build_object('field', 'session.type', 'operator', 'in', 'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')),
        jsonb_build_object('field', 'session.status', 'operator', 'equals', 'value', 'ACTIVE')
      )
    ),
    TRUE, 100, 'EVENT', '{}'::JSONB
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NULL THEN
    SELECT id INTO v_rule_id FROM public.automation_rules
    WHERE name = 'Confirm trial or subsidy session attendance'
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.automation_actions (rule_id, action_type, action_config, order_index)
  SELECT v_rule_id, 'SEND_MESSAGE', jsonb_build_object(
    'message_content', 'Your Altitutor {session.type_label} is booked for {session.start_at}. View or manage it: {session.booking_confirmation_link}',
    'owned_number_id', altitutor_sender_id,
    'recipients', jsonb_build_object('type', 'student_and_parents')
  ), 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_actions
    WHERE automation_actions.rule_id = v_rule_id AND action_type = 'SEND_MESSAGE'
  );

  v_rule_id := NULL;
  INSERT INTO public.automation_rules (
    name, description, entity_type, event_types, conditions, enabled, priority,
    trigger_kind, trigger_config
  ) VALUES (
    'Remind trial or subsidy session attendees',
    'Texts current students and parents before a trial session or subsidy interview. Change offset_minutes to configure the lead time.',
    'sessions', ARRAY['SCHEDULED']::TEXT[],
    jsonb_build_object(
      'all', jsonb_build_array(
        jsonb_build_object('field', 'session.type', 'operator', 'in', 'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')),
        jsonb_build_object('field', 'session.status', 'operator', 'equals', 'value', 'ACTIVE')
      )
    ),
    TRUE, 90, 'RELATIVE_TIME',
    jsonb_build_object('anchor', 'session.start_at', 'offset_minutes', 1440)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NULL THEN
    SELECT id INTO v_rule_id FROM public.automation_rules
    WHERE name = 'Remind trial or subsidy session attendees'
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.automation_actions (rule_id, action_type, action_config, order_index)
  SELECT v_rule_id, 'SEND_MESSAGE', jsonb_build_object(
    'message_content', 'Reminder: your Altitutor {session.type_label} is at {session.start_at}.',
    'owned_number_id', altitutor_sender_id,
    'recipients', jsonb_build_object('type', 'session_students_and_parents')
  ), 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_actions
    WHERE automation_actions.rule_id = v_rule_id AND action_type = 'SEND_MESSAGE'
  );

  v_rule_id := NULL;
  INSERT INTO public.automation_rules (
    name, description, entity_type, event_types, conditions, enabled, priority,
    trigger_kind, trigger_config
  ) VALUES (
    'Notify trial or subsidy schedule changes',
    'Texts all students and parents once when a trial or subsidy start/end time changes.',
    'sessions', ARRAY['UPDATED']::TEXT[],
    jsonb_build_object(
      'all', jsonb_build_array(
        jsonb_build_object('field', 'session.type', 'operator', 'in', 'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')),
        jsonb_build_object('field', 'session.status', 'operator', 'equals', 'value', 'ACTIVE'),
        jsonb_build_object(
          'any', jsonb_build_array(
            jsonb_build_object('field', 'start_at', 'operator', 'field_changed'),
            jsonb_build_object('field', 'end_at', 'operator', 'field_changed')
          )
        )
      )
    ),
    TRUE, 100, 'EVENT', '{}'::JSONB
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NULL THEN
    SELECT id INTO v_rule_id FROM public.automation_rules
    WHERE name = 'Notify trial or subsidy schedule changes'
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.automation_actions (rule_id, action_type, action_config, order_index)
  SELECT v_rule_id, 'SEND_MESSAGE', jsonb_build_object(
    'message_content', 'Your Altitutor {session.type_label} has changed. New time: {session.start_at}. View details: {session.booking_confirmation_link}',
    'owned_number_id', altitutor_sender_id,
    'recipients', jsonb_build_object('type', 'session_students_and_parents')
  ), 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_actions
    WHERE automation_actions.rule_id = v_rule_id AND action_type = 'SEND_MESSAGE'
  );

  v_rule_id := NULL;
  INSERT INTO public.automation_rules (
    name, description, entity_type, event_types, conditions, enabled, priority,
    trigger_kind, trigger_config
  ) VALUES (
    'Send registration after attended trial or subsidy',
    'Texts attended students and attended parents after the tutor log is created.',
    'tutor_logs', ARRAY['CREATED']::TEXT[],
    jsonb_build_object(
      'all', jsonb_build_array(
        jsonb_build_object('field', 'session.type', 'operator', 'in', 'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')),
        jsonb_build_object('field', 'session.status', 'operator', 'equals', 'value', 'ACTIVE')
      )
    ),
    TRUE, 100, 'EVENT', '{}'::JSONB
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NULL THEN
    SELECT id INTO v_rule_id FROM public.automation_rules
    WHERE name = 'Send registration after attended trial or subsidy'
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.automation_actions (rule_id, action_type, action_config, order_index)
  SELECT v_rule_id, 'SEND_MESSAGE', jsonb_build_object(
    'message_content', 'Thanks for attending Altitutor. Register {student.first_name}: {student.registration_link}',
    'owned_number_id', altitutor_sender_id,
    'recipients', jsonb_build_object('type', 'tutor_log_attendees')
  ), 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_actions
    WHERE automation_actions.rule_id = v_rule_id AND action_type = 'SEND_MESSAGE'
  );
END;
$block$;
