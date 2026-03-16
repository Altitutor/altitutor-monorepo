-- Replace generic booking confirmation templates with type-specific ones
-- Delete old templates
DELETE FROM message_templates WHERE template_key IN ('booking_confirmation', 'booking_confirmation_simple');

-- Insert type-specific booking confirmation templates
INSERT INTO message_templates (name, content, template_key, variables, is_active)
VALUES
  (
    'Subsidy Interview Booking Confirmation',
    'Hi {first_name}, your subsidy interview has been booked for {session_date} at {session_time}. View your confirmation: {booking_url}',
    'booking_confirmation_subsidy_interview',
    '["first_name", "booking_url", "session_date", "session_time"]'::jsonb,
    true
  ),
  (
    'Trial Session Booking Confirmation',
    'Hi {first_name}, your trial session is confirmed for {session_date} at {session_time}. View details: {booking_url}',
    'booking_confirmation_trial_session',
    '["first_name", "booking_url", "session_date", "session_time"]'::jsonb,
    true
  ),
  (
    'Staff Interview Booking Confirmation',
    'Hi {first_name}, your staff interview has been booked for {session_date} at {session_time}. View details: {booking_url}',
    'booking_confirmation_staff_interview',
    '["first_name", "booking_url", "session_date", "session_time"]'::jsonb,
    true
  ),
  (
    'Drafting Booking Confirmation',
    'Hi {first_name}, you have been drafted for a session on {session_date} at {session_time}. View details: {booking_url}',
    'booking_confirmation_drafting',
    '["first_name", "booking_url", "session_date", "session_time"]'::jsonb,
    true
  ),
  (
    'Booking Confirmation (no date/time)',
    'Hi {first_name}, view your booking confirmation: {booking_url}',
    'booking_confirmation_simple',
    '["first_name", "booking_url"]'::jsonb,
    true
  )
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  updated_at = now();
