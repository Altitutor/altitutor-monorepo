-- Migration: Update Uninvoiced Sessions View with Session Name and Attendance Fields
-- Description:
--  - Add session_name field formatted as "{subject longname} {time h:mm p} {date ddd m} {session type}"
--  - Add planned attendance fields: is_rescheduled, is_credited, is_extra
--  - Add actual attendance fields: has_tutor_log, actual_attended
-- Purpose: Enable reconciliation dashboard to display session names and attendance status

DROP VIEW IF EXISTS public.vadmin_reconciliation_uninvoiced_sessions;

CREATE VIEW public.vadmin_reconciliation_uninvoiced_sessions
WITH (security_invoker = false)
AS
SELECT 
  ss.id AS sessions_students_id,
  ss.student_id,
  ss.session_id,
  ss.planned_absence,
  ss.is_rescheduled,
  ss.is_credited,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  s.billing_type,
  s.subject_id,
  sub.name AS subject_name,
  sub.long_name AS subject_long_name,
  -- Session name formatted as "{subject longname} {time h:mm p} {date ddd m} {session type}"
  -- Example: "SACE Year 12 Mathematics 2:30 PM Mon 1 CLASS"
  TRIM(
    COALESCE(NULLIF(sub.long_name, ''), '') ||
    CASE 
      WHEN sub.long_name IS NOT NULL AND sub.long_name != '' THEN ' ' ELSE ''
    END ||
    CASE 
      WHEN s.start_at IS NOT NULL THEN
        TO_CHAR(s.start_at AT TIME ZONE 'UTC', 'HH12:MI AM') || ' ' ||
        TO_CHAR(s.start_at AT TIME ZONE 'UTC', 'Dy D')
      ELSE ''
    END ||
    CASE 
      WHEN s.type IS NOT NULL THEN ' ' || s.type::text
      ELSE ''
    END
  ) AS session_name,
  -- Calculate is_extra: student is extra if session has class_id but student is not enrolled
  CASE 
    WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
    ELSE false
  END AS is_extra,
  -- Check if tutor log exists for this session
  EXISTS (
    SELECT 1 FROM public.tutor_logs tl 
    WHERE tl.session_id = s.id
  ) AS has_tutor_log,
  -- Get actual attendance from tutor_logs_student_attendance
  (
    SELECT tlsa.attended
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_attended,
  -- Student details
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  -- Metadata
  ss.created_at,
  ss.updated_at
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ss.student_id
LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id 
  AND cs.student_id = ss.student_id 
  AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
WHERE 
  ss.planned_absence = false
  AND s.start_at < NOW()  -- Only past sessions
  AND s.billing_type IS NOT NULL  -- Only billable sessions
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_items ii 
    WHERE ii.sessions_students_id = ss.id
  );

GRANT SELECT ON public.vadmin_reconciliation_uninvoiced_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_uninvoiced_sessions IS 
  'Admin view: Past sessions without invoice items (need manual invoicing). Includes session name and attendance fields.';
