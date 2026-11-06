-- Start the in-person relationship without changing the Student's login or products.
-- Row locking keeps concurrent requests on one Student/journey. Registration,
-- rather than this staff action, remains the only first-activation step.
CREATE FUNCTION public.start_student_in_person_onboarding(p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_journey_id uuid;
BEGIN
  IF NOT coalesce((SELECT public.is_adminstaff_active()), false) THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student FROM public.students
  WHERE id = p_student_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.status IS NOT NULL AND v_student.status <> 'TRIAL' THEN
    RAISE EXCEPTION 'In-person onboarding is only available before registration'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.students SET status = 'TRIAL'
  WHERE id = p_student_id AND status IS NULL;

  -- An earlier enquiry may already exist. Do not invent its original date when
  -- staff starts from the Student record, or replace its existing history.
  INSERT INTO public.onboarding_journeys(student_id, label, historical)
  VALUES (p_student_id, concat_ws(' ', v_student.first_name, v_student.last_name), true)
  ON CONFLICT (student_id) WHERE closed_at IS NULL AND student_id IS NOT NULL DO NOTHING;
  SELECT id INTO v_journey_id FROM public.onboarding_journeys
  WHERE student_id = p_student_id AND closed_at IS NULL;
  RETURN v_journey_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_student_in_person_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_student_in_person_onboarding(uuid) TO authenticated;
