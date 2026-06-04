-- Migration: CHECK_IN host/receiver roles on sessions_staff
-- Description:
--   Adds CHECK_IN_HOST (conducting) and CHECK_IN_RECEIVER (receiving tier review) for check-in sessions.
--   Migrates existing CHECK_IN session staff from MAIN_TUTOR/SECONDARY_TUTOR.

ALTER TABLE public.sessions_staff
  DROP CONSTRAINT IF EXISTS sessions_staff_type_check;

ALTER TABLE public.sessions_staff
  ADD CONSTRAINT sessions_staff_type_check CHECK (
    type IN (
      'MAIN_TUTOR',
      'SECONDARY_TUTOR',
      'TRIAL_TUTOR',
      'CHECK_IN_HOST',
      'CHECK_IN_RECEIVER'
    )
  );

ALTER TABLE public.tutor_logs_staff_attendance
  DROP CONSTRAINT IF EXISTS tutor_logs_staff_attendance_type_check;

ALTER TABLE public.tutor_logs_staff_attendance
  ADD CONSTRAINT tutor_logs_staff_attendance_type_check CHECK (
    type IN (
      'MAIN_TUTOR',
      'SECONDARY_TUTOR',
      'TRIAL_TUTOR',
      'CHECK_IN_HOST',
      'CHECK_IN_RECEIVER'
    )
  );

-- CHECK_IN sessions: primary staff member was MAIN_TUTOR → receiver; others → host
UPDATE public.sessions_staff ss
SET type = 'CHECK_IN_RECEIVER'
FROM public.sessions s
WHERE s.id = ss.session_id
  AND s.type = 'CHECK_IN'
  AND ss.type = 'MAIN_TUTOR';

UPDATE public.sessions_staff ss
SET type = 'CHECK_IN_HOST'
FROM public.sessions s
WHERE s.id = ss.session_id
  AND s.type = 'CHECK_IN'
  AND ss.type IN ('SECONDARY_TUTOR', 'TRIAL_TUTOR');

UPDATE public.tutor_logs_staff_attendance tla
SET type = 'CHECK_IN_RECEIVER'
FROM public.tutor_logs tl
JOIN public.sessions s ON s.id = tl.session_id
WHERE tl.id = tla.tutor_log_id
  AND s.type = 'CHECK_IN'
  AND tla.type = 'MAIN_TUTOR';

UPDATE public.tutor_logs_staff_attendance tla
SET type = 'CHECK_IN_HOST'
FROM public.tutor_logs tl
JOIN public.sessions s ON s.id = tl.session_id
WHERE tl.id = tla.tutor_log_id
  AND s.type = 'CHECK_IN'
  AND tla.type IN ('SECONDARY_TUTOR', 'TRIAL_TUTOR');
