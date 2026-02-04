-- Migration: Simplify reconciliation view using was_trial
-- Description:
--  - Simplify vadmin_reconciliation_uninvoiced_sessions to use was_trial instead of activity_events
--  - Remove complex activity_events logic checking for status changes
--  - Simply exclude sessions where ss.was_trial = TRUE
-- Purpose: Simplify and improve performance of reconciliation view now that was_trial is stored directly

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
  ss.was_trial,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  s.billing_type,
  s.subject_id,
  sub.name AS subject_name,
  sub.long_name AS subject_long_name,
  -- Session name formatted as "{subject longname} {time h:mm p} {date ddd d MMM} {session type}"
  -- Example: "SACE Year 12 Mathematics 2:30 PM Mon 1 Jan CLASS"
  TRIM(
    COALESCE(NULLIF(sub.long_name, ''), '') ||
    CASE 
      WHEN sub.long_name IS NOT NULL AND sub.long_name != '' THEN ' ' ELSE ''
    END ||
    CASE 
      WHEN s.start_at IS NOT NULL THEN
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'HH12:MI AM') || ' ' ||
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy FMDD Mon')
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
  -- Get actual was_trial from tutor_logs_student_attendance
  (
    SELECT tlsa.was_trial
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_was_trial,
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
  s.start_at < NOW()  -- Only past sessions
  AND s.billing_type IS NOT NULL  -- Only billable sessions
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_items ii 
    WHERE ii.sessions_students_id = ss.id
  )
  AND (
    -- Include sessions where planned_absence = false (normal case)
    ss.planned_absence = false
    OR
    -- Include sessions where planned_absence = true BUT tutor log shows they actually attended
    (
      ss.planned_absence = true
      AND EXISTS (
        SELECT 1
        FROM public.tutor_logs tl
        JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
        WHERE tl.session_id = s.id
          AND tlsa.student_id = ss.student_id
          AND tlsa.attended = true
      )
    )
  )
  -- Simplified: Exclude sessions where student was TRIAL at the time
  -- This is much simpler and more performant than checking activity_events
  AND ss.was_trial = FALSE;

GRANT SELECT ON public.vadmin_reconciliation_uninvoiced_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_uninvoiced_sessions IS 
  'Admin view: Past sessions without invoice items (need manual invoicing). Includes planned absences that actually attended (tutor log shows attended = true). Excludes sessions for students who were TRIAL at the time (using was_trial flag). Includes session name (Adelaide timezone), attendance fields, and was_trial flags for both planned and actual attendance.';
