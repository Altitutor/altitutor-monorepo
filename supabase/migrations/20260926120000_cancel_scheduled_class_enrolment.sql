-- A class enrolment that has not started has no final lesson to keep.
-- Unenrol and class transfer both require an end instant after enrolled_at, so they
-- cannot remove that row. Cancel deletes it, and replace enrols the new class first.

CREATE OR REPLACE FUNCTION public.require_scheduled_class_enrolment(
  p_student_id uuid,
  p_class_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_enrolled_at timestamptz;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') AND NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Only active admin staff may change class enrolments' USING ERRCODE = '42501';
  END IF;

  SELECT enrolment.id, enrolment.enrolled_at
  INTO v_id, v_enrolled_at
  FROM public.classes_students enrolment
  WHERE enrolment.student_id = p_student_id
    AND enrolment.class_id = p_class_id
    AND enrolment.unenrolled_at IS NULL
  ORDER BY enrolment.enrolled_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current class enrolment not found';
  END IF;
  IF v_enrolled_at <= now() THEN
    RAISE EXCEPTION 'This class has already started. Unenrol it instead of cancelling the enrolment';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.sessions_students assignment
    JOIN public.sessions session ON session.id = assignment.session_id
    WHERE assignment.student_id = p_student_id
      AND session.class_id = p_class_id
      AND session.start_at <= now()
  ) THEN
    RAISE EXCEPTION 'This class has already started. Unenrol it instead of cancelling the enrolment';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.invoice_items item
    JOIN public.sessions_students assignment ON assignment.id = item.sessions_students_id
    JOIN public.sessions session ON session.id = assignment.session_id
    WHERE assignment.student_id = p_student_id
      AND session.class_id = p_class_id
      AND item.deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.session_billing_adjustments adjustment
    JOIN public.sessions_students assignment ON assignment.id = adjustment.sessions_students_id
    JOIN public.sessions session ON session.id = assignment.session_id
    WHERE assignment.student_id = p_student_id
      AND session.class_id = p_class_id
  ) OR EXISTS (
    SELECT 1
    FROM public.tutor_logs_student_attendance attendance
    JOIN public.tutor_logs log ON log.id = attendance.tutor_log_id
    JOIN public.sessions session ON session.id = log.session_id
    WHERE attendance.student_id = p_student_id
      AND session.class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'This enrolment already has attendance or billing history. Unenrol it instead';
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.require_scheduled_class_enrolment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_scheduled_class_enrolment(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_class_enrolment(
  p_student_id uuid,
  p_class_id uuid,
  p_staff_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_enrolment_id uuid;
BEGIN
  IF p_staff_id IS NULL THEN
    RAISE EXCEPTION 'A staff member is required';
  END IF;
  PERFORM 1 FROM public.students WHERE id = p_student_id FOR UPDATE;
  v_enrolment_id := public.require_scheduled_class_enrolment(p_student_id, p_class_id);

  DELETE FROM public.sessions_students assignment
  USING public.sessions session
  WHERE assignment.session_id = session.id
    AND assignment.student_id = p_student_id
    AND session.class_id = p_class_id;

  DELETE FROM public.notes
  WHERE target_type = 'classes_students'
    AND target_id = v_enrolment_id;

  DELETE FROM public.classes_students WHERE id = v_enrolment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_class_enrolment(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_class_enrolment(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.replace_scheduled_class_enrolment(
  p_student_id uuid,
  p_old_class_id uuid,
  p_new_class_id uuid,
  p_enrolled_at timestamptz,
  p_staff_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  IF p_enrolled_at IS NULL THEN
    RAISE EXCEPTION 'An enrolment start is required';
  END IF;
  IF p_old_class_id = p_new_class_id THEN
    RAISE EXCEPTION 'Choose a different destination class';
  END IF;

  PERFORM 1 FROM public.students WHERE id = p_student_id AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student must be active to enrol in a class';
  END IF;
  PERFORM 1
  FROM public.classes
  WHERE id = p_new_class_id
    AND status = 'ACTIVE'
    AND session_type = 'CLASS';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active class';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.classes_students
    WHERE student_id = p_student_id
      AND class_id = p_new_class_id
      AND (unenrolled_at IS NULL OR unenrolled_at > p_enrolled_at)
  ) THEN
    RAISE EXCEPTION 'Student is already enrolled in the new class';
  END IF;

  PERFORM public.require_scheduled_class_enrolment(p_student_id, p_old_class_id);

  INSERT INTO public.classes_students (id, class_id, student_id, enrolled_at, enrolled_by)
  VALUES (gen_random_uuid(), p_new_class_id, p_student_id, p_enrolled_at, p_staff_id)
  RETURNING id INTO v_new_id;

  PERFORM public.cancel_scheduled_class_enrolment(p_student_id, p_old_class_id, p_staff_id);
  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_scheduled_class_enrolment(uuid, uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_scheduled_class_enrolment(uuid, uuid, uuid, timestamptz, uuid) TO authenticated, service_role;
