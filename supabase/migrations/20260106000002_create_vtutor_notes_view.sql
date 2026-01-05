-- Migration: Create vtutor_notes view
-- Tutors can only see notes attached to entities they can access through other views

-- ========================
-- VIEW: vtutor_notes
-- Notes for entities tutors can access (sessions, tutor_logs)
-- ========================

CREATE OR REPLACE VIEW public.vtutor_notes
WITH (security_invoker = false)
AS
SELECT 
  n.id,
  n.target_type,
  n.target_id,
  n.note,
  n.created_at,
  n.created_by,
  -- Include staff info for created_by
  (
    SELECT json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name
    )
    FROM public.staff s
    WHERE s.id = n.created_by
  ) AS staff
FROM public.notes n
WHERE 
  -- Notes for sessions the tutor can access
  (n.target_type = 'sessions' AND n.target_id IN (
    SELECT session_id 
    FROM public.sessions_staff 
    WHERE staff_id = public.current_tutor_id()
  ))
  OR
  -- Notes for tutor logs the tutor can access
  (n.target_type = 'tutor_logs' AND n.target_id IN (
    SELECT id
    FROM public.tutor_logs tl
    WHERE 
      tl.created_by = public.current_tutor_id()
      OR
      tl.id IN (
        SELECT tutor_log_id 
        FROM public.tutor_logs_staff_attendance 
        WHERE staff_id = public.current_tutor_id()
      )
      OR
      tl.session_id IN (
        SELECT session_id 
        FROM public.sessions_staff 
        WHERE staff_id = public.current_tutor_id()
      )
  ));

GRANT SELECT ON public.vtutor_notes TO authenticated;

COMMENT ON VIEW public.vtutor_notes IS 'Tutor view: Notes for entities tutors can access (sessions, tutor_logs)';

