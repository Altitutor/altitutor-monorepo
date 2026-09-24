-- Send a one-time welcome SMS when an in-person Student completes registration.
-- `registered_at` is the durable first-activation marker; unlike `status`, it is
-- never reset on discontinuation/reactivation and is independent of online-only
-- product relationships.

DO $block$
DECLARE
  altitutor_sender_id UUID;
  registration_rule_id UUID;
BEGIN
  SELECT id INTO altitutor_sender_id
  FROM public.owned_numbers
  WHERE sender_type = 'ALPHANUMERIC'
    AND alphanumeric_sender_id = 'ALTITUTOR'
  LIMIT 1;

  IF altitutor_sender_id IS NULL THEN
    RAISE EXCEPTION 'ALTITUTOR alphanumeric sender is required';
  END IF;

  INSERT INTO public.automation_rules (
    name,
    description,
    entity_type,
    event_types,
    conditions,
    enabled,
    priority,
    trigger_kind,
    trigger_config
  ) VALUES (
    'Thank student and parents after successful registration',
    'Texts the student and all parents once when the Student first completes in-person registration.',
    'students',
    ARRAY['UPDATED']::TEXT[],
    jsonb_build_object(
      'all', jsonb_build_array(
        jsonb_build_object(
          'field', 'registered_at',
          'operator', 'field_changed'
        ),
        jsonb_build_object(
          'field', 'entity.status',
          'operator', 'equals',
          'value', 'ACTIVE'
        )
      )
    ),
    TRUE,
    100,
    'EVENT',
    '{}'::JSONB
  )
  RETURNING id INTO registration_rule_id;

  INSERT INTO public.automation_actions (
    rule_id,
    action_type,
    action_config,
    order_index
  ) VALUES (
    registration_rule_id,
    'SEND_MESSAGE',
    jsonb_build_object(
      'message_content', 'Hi {student.first_name}, thank you for registering as a student at Altitutor. We are organising your weekly sessions and will send you a text with the times once we have done this. Looking forward to learning together!',
      'owned_number_id', altitutor_sender_id,
      'recipients', jsonb_build_object('type', 'student_and_parents')
    ),
    0
  );
END;
$block$;
