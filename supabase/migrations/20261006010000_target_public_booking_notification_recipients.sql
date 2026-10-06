-- Bookings and cancellations affect the assigned staff and original booking creator.
UPDATE public.automation_actions AS action
SET action_config = jsonb_set(
  action.action_config,
  '{recipients}',
  '{"type":"session_staff_and_booking_creator"}'::jsonb
)
FROM public.automation_rules AS rule
WHERE rule.id = action.rule_id
  AND rule.name IN (
    'Notify admins of new trial or subsidy sessions',
    'Notify admins of cancelled trial or subsidy sessions'
  )
  AND action.action_type = 'CREATE_NOTIFICATION'
  AND action.action_config->>'notification_type' IN (
    'TRIAL_SESSION_BOOKED', 'PUBLIC_BOOKING_CANCELLED'
  );
