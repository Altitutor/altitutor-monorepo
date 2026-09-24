BEGIN;
SELECT plan(6);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_rules
    WHERE name = 'Notify admins of new trial or subsidy sessions'
      AND enabled
      AND event_names = ARRAY['session.created']
      AND conditions @> jsonb_build_object(
        'field', 'type',
        'operator', 'in',
        'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')
      )
  ),
  'Admin new-booking notify covers trial sessions and subsidy interviews'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_actions action
    JOIN public.automation_rules rule ON rule.id = action.rule_id
    WHERE rule.name = 'Notify admins of new trial or subsidy sessions'
      AND action.action_type = 'CREATE_NOTIFICATION'
      AND action.action_config->>'title' = 'New {session.type_label} booked'
  ),
  'Admin new-booking notify title names the booked session type'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_rules
    WHERE name = 'Notify admins of cancelled trial or subsidy sessions'
      AND enabled
      AND event_names = ARRAY['session.status_changed']
      AND conditions @> jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object(
            'field', 'type',
            'operator', 'in',
            'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')
          ),
          jsonb_build_object('field', 'status', 'operator', 'equals', 'value', 'INACTIVE')
        )
      )
  ),
  'Admin cancellation notify listens for trial or subsidy status changes to inactive'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_actions action
    JOIN public.automation_rules rule ON rule.id = action.rule_id
    WHERE rule.name = 'Notify admins of cancelled trial or subsidy sessions'
      AND action.action_type = 'CREATE_NOTIFICATION'
      AND action.action_config->>'notification_type' = 'PUBLIC_BOOKING_CANCELLED'
      AND action.action_config->'recipients'->>'type' = 'all_admin_staff'
  ),
  'Admin cancellation notify fans out to all admin staff'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_rules
    WHERE name = 'Notify trial or subsidy attendees of cancellation'
      AND enabled
      AND event_names = ARRAY['session.status_changed']
  ),
  'Family cancellation SMS listens for the same public-booking cancellations'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_actions action
    JOIN public.automation_rules rule ON rule.id = action.rule_id
    WHERE rule.name = 'Notify trial or subsidy attendees of cancellation'
      AND action.action_type = 'SEND_MESSAGE'
      AND action.action_config->'recipients'->>'type' = 'session_students_and_parents'
  ),
  'Family cancellation SMS goes to the session student and parents'
);

SELECT * FROM finish();
ROLLBACK;
