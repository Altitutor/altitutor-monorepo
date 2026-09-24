-- Cover subsidy interviews in the admin new-booking notification, and notify
-- admins plus the family when a trial or subsidy booking is cancelled.

DO $block$
DECLARE
  v_rule_id UUID;
  v_sender_id UUID;
  v_cancel_conditions JSONB := jsonb_build_object(
    'all', jsonb_build_array(
      jsonb_build_object(
        'field', 'type',
        'operator', 'in',
        'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')
      ),
      jsonb_build_object('field', 'status', 'operator', 'equals', 'value', 'INACTIVE')
    )
  );
BEGIN
  UPDATE public.automation_rules
  SET
    name = 'Notify admins of new trial or subsidy sessions',
    description = 'Creates an admin notification whenever a trial session or subsidy interview is booked.',
    conditions = jsonb_build_object(
      'field', 'type',
      'operator', 'in',
      'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')
    ),
    event_names = ARRAY['session.created']
  WHERE name IN (
    'Notify admins of new trial sessions',
    'Notify admins of new trial or subsidy sessions'
  );

  UPDATE public.automation_actions action
  SET action_config = action.action_config || jsonb_build_object(
    'title', 'New {session.type_label} booked'
  )
  FROM public.automation_rules rule
  WHERE action.rule_id = rule.id
    AND rule.name = 'Notify admins of new trial or subsidy sessions'
    AND action.action_type = 'CREATE_NOTIFICATION';

  SELECT id
  INTO v_rule_id
  FROM public.automation_rules
  WHERE name = 'Notify admins of cancelled trial or subsidy sessions'
  ORDER BY created_at
  LIMIT 1;

  IF v_rule_id IS NULL THEN
    INSERT INTO public.automation_rules (
      name,
      description,
      entity_type,
      event_names,
      conditions,
      enabled,
      priority,
      trigger_kind,
      trigger_config
    )
    VALUES (
      'Notify admins of cancelled trial or subsidy sessions',
      'Creates an admin notification whenever a trial session or subsidy interview is cancelled.',
      'sessions',
      ARRAY['session.status_changed']::TEXT[],
      v_cancel_conditions,
      TRUE,
      100,
      'EVENT',
      '{}'::JSONB
    )
    RETURNING id INTO v_rule_id;
  ELSE
    UPDATE public.automation_rules
    SET
      description = 'Creates an admin notification whenever a trial session or subsidy interview is cancelled.',
      event_names = ARRAY['session.status_changed']::TEXT[],
      conditions = v_cancel_conditions,
      enabled = TRUE,
      trigger_kind = 'EVENT'
    WHERE id = v_rule_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.automation_actions
    WHERE rule_id = v_rule_id
      AND action_type = 'CREATE_NOTIFICATION'
      AND action_config->>'notification_type' = 'PUBLIC_BOOKING_CANCELLED'
  ) THEN
    INSERT INTO public.automation_actions (
      rule_id,
      action_type,
      action_config,
      order_index
    )
    VALUES (
      v_rule_id,
      'CREATE_NOTIFICATION',
      jsonb_build_object(
        'notification_type', 'PUBLIC_BOOKING_CANCELLED',
        'app_scope', 'staff_web',
        'title', '{session.type_label} cancelled',
        'body', '{entity_name}',
        'action_url', 'modal://session/{entity_id}',
        'recipients', jsonb_build_object('type', 'all_admin_staff')
      ),
      0
    );
  END IF;

  SELECT id INTO v_sender_id
  FROM public.owned_numbers
  WHERE sender_type = 'ALPHANUMERIC'
    AND alphanumeric_sender_id = 'ALTITUTOR'
  LIMIT 1;

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'ALTITUTOR alphanumeric sender is required';
  END IF;

  v_rule_id := NULL;
  SELECT id
  INTO v_rule_id
  FROM public.automation_rules
  WHERE name = 'Notify trial or subsidy attendees of cancellation'
  ORDER BY created_at
  LIMIT 1;

  IF v_rule_id IS NULL THEN
    INSERT INTO public.automation_rules (
      name,
      description,
      entity_type,
      event_names,
      conditions,
      enabled,
      priority,
      trigger_kind,
      trigger_config
    )
    VALUES (
      'Notify trial or subsidy attendees of cancellation',
      'Texts current students and parents when a trial session or subsidy interview is cancelled.',
      'sessions',
      ARRAY['session.status_changed']::TEXT[],
      v_cancel_conditions,
      TRUE,
      100,
      'EVENT',
      '{}'::JSONB
    )
    RETURNING id INTO v_rule_id;
  ELSE
    UPDATE public.automation_rules
    SET
      description = 'Texts current students and parents when a trial session or subsidy interview is cancelled.',
      event_names = ARRAY['session.status_changed']::TEXT[],
      conditions = v_cancel_conditions,
      enabled = TRUE,
      trigger_kind = 'EVENT'
    WHERE id = v_rule_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.automation_actions
    WHERE rule_id = v_rule_id
      AND action_type = 'SEND_MESSAGE'
  ) THEN
    INSERT INTO public.automation_actions (
      rule_id,
      action_type,
      action_config,
      order_index
    )
    VALUES (
      v_rule_id,
      'SEND_MESSAGE',
      jsonb_build_object(
        'message_content', 'Your Altitutor {session.type_label} on {session.start_at} has been cancelled.',
        'owned_number_id', v_sender_id,
        'recipients', jsonb_build_object('type', 'session_students_and_parents')
      ),
      0
    );
  END IF;
END;
$block$;
