-- These quota helpers are called by the server using its service client.
REVOKE EXECUTE ON FUNCTION
  public.student_has_in_person_ucat_session_resource(uuid, text, uuid),
  public.student_in_person_ucat_session_resource_ids(uuid, text, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.student_has_in_person_ucat_session_resource(uuid, text, uuid),
  public.student_in_person_ucat_session_resource_ids(uuid, text, uuid[])
  TO service_role;

CREATE OR REPLACE FUNCTION public.interview_student_has_access(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    coalesce(p_student_id = (SELECT public.current_student_id()), false)
    OR (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL
    -- SECURITY DEFINER changes current_user. Check the role set by PostgREST.
    OR (SELECT current_setting('role')) = 'service_role'
  )
  AND EXISTS (
    SELECT 1
    FROM public.students AS student
    JOIN public.classes_students AS enrolment ON enrolment.student_id = student.id
    JOIN public.classes AS class ON class.id = enrolment.class_id
    JOIN public.subjects AS subject ON subject.id = class.subject_id
    WHERE student.id = p_student_id
      AND student.status IN ('ACTIVE', 'TRIAL')
      AND enrolment.enrolled_at <= now()
      AND (enrolment.unenrolled_at IS NULL OR enrolment.unenrolled_at > now())
      AND lower(btrim(subject.name)) = 'medicine interview'
  );
$$;
