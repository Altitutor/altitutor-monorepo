-- Add {sender_name} to all system templates that don't have it yet
-- Booking confirmations and invites get a sign-off; templates that already have it are unchanged

UPDATE message_templates SET
  content = 'Hi {first_name}, your subsidy interview has been booked for {session_date} at {session_time}. View your confirmation: {booking_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "booking_url", "session_date", "session_time", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'booking_confirmation_subsidy_interview';

UPDATE message_templates SET
  content = 'Hi {first_name}, your trial session is confirmed for {session_date} at {session_time}. View details: {booking_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "booking_url", "session_date", "session_time", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'booking_confirmation_trial_session';

UPDATE message_templates SET
  content = 'Hi {first_name}, your staff interview has been booked for {session_date} at {session_time}. View details: {booking_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "booking_url", "session_date", "session_time", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'booking_confirmation_staff_interview';

UPDATE message_templates SET
  content = 'Hi {first_name}, you have been drafted for a session on {session_date} at {session_time}. View details: {booking_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "booking_url", "session_date", "session_time", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'booking_confirmation_drafting';

UPDATE message_templates SET
  content = 'Hi {first_name}, view your booking confirmation: {booking_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "booking_url", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'booking_confirmation_simple';

UPDATE message_templates SET
  content = 'Hi {first_name}, click on this link to log into your Altitutor account: {invite_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "invite_url", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'student_invite';

UPDATE message_templates SET
  content = 'Hi {first_name},

Thank you for coming to your trial session. To register {student_name} as a student at Altitutor, please click the link below:

{invite_url}

Kind regards,
{sender_name}',
  variables = '["first_name", "invite_url", "student_name", "sender_name"]'::jsonb,
  updated_at = now()
WHERE template_key = 'student_registration_invite';
