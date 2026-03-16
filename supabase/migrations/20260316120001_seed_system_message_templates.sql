-- Seed system message templates from current hardcoded content
-- Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe (template_key is unique)

INSERT INTO message_templates (name, content, template_key, variables, is_active)
VALUES
  (
    'Booking Confirmation',
    'Hi {first_name}, view your booking confirmation for {session_date} at {session_time}: {booking_url}',
    'booking_confirmation',
    '["first_name", "booking_url", "session_date", "session_time"]'::jsonb,
    true
  ),
  (
    'Booking Confirmation (no date/time)',
    'Hi {first_name}, view your booking confirmation: {booking_url}',
    'booking_confirmation_simple',
    '["first_name", "booking_url"]'::jsonb,
    true
  ),
  (
    'Absence Notification',
    'Hi {recipient_name},

I have processed the following absences for you:
{absence_details}

Kind regards,

{sender_name}, Altitutor Admin',
    'absence_notification',
    '["recipient_name", "sender_name", "absence_details"]'::jsonb,
    true
  ),
  (
    'Student Invite (login)',
    'Hi {first_name}, click on this link to log into your Altitutor account: {invite_url}',
    'student_invite',
    '["first_name", "invite_url"]'::jsonb,
    true
  ),
  (
    'Student Registration Invite',
    'Hi {first_name},

Thank you for coming to your trial session. To register {student_name} as a student at Altitutor, please click the link below:

{invite_url}',
    'student_registration_invite',
    '["first_name", "invite_url", "student_name"]'::jsonb,
    true
  ),
  (
    'Enrollment Confirmation',
    'Hi {name},

You have been enrolled in the following class:

{class_name}, starting on {start_date}

Kind regards,

{sender_name}',
    'enrollment_confirmation',
    '["name", "class_name", "start_date", "sender_name"]'::jsonb,
    true
  ),
  (
    'Unenrollment Confirmation',
    'Hi {name},

You have been unenrolled from the following class:

{class_name}, final session on {final_session_date}

Kind regards,

{sender_name}',
    'unenrollment_confirmation',
    '["name", "class_name", "final_session_date", "sender_name"]'::jsonb,
    true
  ),
  (
    'Change Class Confirmation',
    'Hi {name},

Your class has been changed:

From: {old_class_name}, your last session of this class will be on {old_class_last_session_date}
To: {new_class_name}, your first session of this class will be on {new_class_first_session_date}

Kind regards,

{sender_name}',
    'change_class_confirmation',
    '["name", "old_class_name", "new_class_name", "old_class_last_session_date", "new_class_first_session_date", "sender_name"]'::jsonb,
    true
  )
ON CONFLICT (template_key) DO NOTHING;
