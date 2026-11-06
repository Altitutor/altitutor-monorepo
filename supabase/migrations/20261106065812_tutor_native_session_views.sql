-- Match TutorWeb's participant eligibility while omitting contact details and
-- keeping base tables closed to tutor clients. Derive the same UUID so
-- PostgREST treats the picker IDs as values, without relationship embedding.
CREATE VIEW public.vtutor_session_student_candidates
WITH (security_invoker = false, security_barrier = true)
AS
SELECT (student.id::text)::uuid AS id, student.first_name, student.last_name, student.status
FROM public.students student
WHERE (SELECT public.is_tutor())
  AND student.status IN ('ACTIVE', 'TRIAL');

CREATE VIEW public.vtutor_session_staff_candidates
WITH (security_invoker = false, security_barrier = true)
AS
SELECT (staff.id::text)::uuid AS id, staff.first_name, staff.last_name, staff.role, staff.status
FROM public.staff staff
WHERE (SELECT public.is_tutor())
  AND staff.status IN ('ACTIVE', 'TRIAL');

-- The dashboard filters by the selected session IDs. Key the view on the
-- assignment so those filters apply before evaluating first attendance.
CREATE VIEW public.vtutor_dashboard_new_class_students
WITH (security_invoker = false, security_barrier = true)
AS
SELECT assignment.session_id, new_student.student_id
FROM public.sessions_staff assignment
CROSS JOIN LATERAL public.dashboard_new_class_students(ARRAY[assignment.session_id]) new_student
WHERE assignment.staff_id = (SELECT public.current_tutor_id());

CREATE OR REPLACE VIEW public.vtutor_office_print_settings
WITH (security_invoker = false)
AS
SELECT settings.tutor_access,
  (SELECT public.is_print_connector_online()) AS connector_online,
  (SELECT public.is_office_print_window_open()) AS window_open
FROM public.office_print_settings settings
WHERE (SELECT public.is_tutor());

REVOKE ALL ON public.vtutor_session_student_candidates, public.vtutor_session_staff_candidates,
  public.vtutor_dashboard_new_class_students, public.vtutor_office_print_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_session_student_candidates, public.vtutor_session_staff_candidates,
  public.vtutor_dashboard_new_class_students, public.vtutor_office_print_settings TO authenticated;
