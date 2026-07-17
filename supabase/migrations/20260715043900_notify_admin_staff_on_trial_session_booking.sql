-- Notify every active admin staff member when a trial session is created.
-- Session inserts already flow through activity_events and activity-processor;
-- keep the product behaviour in the existing automation system so recipients,
-- copy, and enabled state remain visible and editable in admin-web settings.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

DO $$
DECLARE
  v_rule_id UUID;
BEGIN
  SELECT id
  INTO v_rule_id
  FROM public.automation_rules
  WHERE name = 'Notify admins of new trial sessions'
  ORDER BY created_at
  LIMIT 1;

  IF v_rule_id IS NULL THEN
    INSERT INTO public.automation_rules (
      name,
      description,
      entity_type,
      event_types,
      conditions,
      enabled,
      priority
    )
    VALUES (
      'Notify admins of new trial sessions',
      'Creates an admin notification whenever a trial session is booked.',
      'sessions',
      ARRAY['CREATED']::TEXT[],
      jsonb_build_object('field', 'type', 'operator', 'equals', 'value', 'TRIAL_SESSION'),
      TRUE,
      0
    )
    RETURNING id INTO v_rule_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.automation_actions
    WHERE rule_id = v_rule_id
      AND action_type = 'CREATE_NOTIFICATION'
      AND action_config->>'notification_type' = 'TRIAL_SESSION_BOOKED'
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
        'notification_type', 'TRIAL_SESSION_BOOKED',
        'app_scope', 'staff_web',
        'title', 'New trial session booked',
        'body', '{entity_name}',
        'action_url', 'modal://session/{entity_id}',
        'recipients', jsonb_build_object('type', 'all_admin_staff')
      ),
      0
    );
  END IF;
END;
$$;
