-- These SECURITY DEFINER RPCs accepted caller-supplied student/staff IDs without
-- binding them to the caller. Class enrolment stays an active-AdminStaff command;
-- student absence logging and UCAT Pro status lookups are server-only, called
-- with the service role after the server resolves the caller's identity.

CREATE OR REPLACE FUNCTION public.enroll_student_in_class(
  p_class_id UUID,
  p_student_id UUID,
  p_enrolled_at TIMESTAMPTZ,
  p_enrolled_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_student_status TEXT;
BEGIN
  IF coalesce((SELECT auth.role()), '') <> 'service_role'
     AND NOT coalesce((SELECT public.is_adminstaff_active()), false) THEN
    RAISE EXCEPTION 'Only active admin staff may change class enrolments'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Student must be active to enrol in a class';
  END IF;

  INSERT INTO classes_students (
    id,
    class_id,
    student_id,
    enrolled_at,
    enrolled_by
  ) VALUES (
    gen_random_uuid(),
    p_class_id,
    p_student_id,
    p_enrolled_at,
    p_enrolled_by
  )
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;

COMMENT ON FUNCTION public.enroll_student_in_class(uuid, uuid, timestamptz, uuid) IS
  'Active ADMINSTAFF (or the service role) enrols an ACTIVE student in a class.';

REVOKE ALL ON FUNCTION public.enroll_student_in_class(uuid, uuid, timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_class(uuid, uuid, timestamptz, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_student_absences_self(jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_student_absences_self(jsonb, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION private.log_student_absences_self_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.student_has_ucat_pro_subscription(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_has_ucat_pro_subscription(uuid)
  TO service_role;
