-- Check-in role is a TutorWeb presentation/API concern. The service-role-only
-- tutor-log RPCs validate the actor and operational assignment, but permit an
-- active ADMINSTAFF to attribute a check-in log to any assigned staff member.

CREATE OR REPLACE FUNCTION public.enforce_tutor_log_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'tutor_log_submitter_required';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'tutor_log_submitter_is_immutable';
  END IF;

  IF NEW.logged_for_staff_id IS NULL THEN
    RAISE EXCEPTION 'tutor_log_logged_for_staff_required';
  END IF;

  PERFORM 1
  FROM public.sessions_staff
  WHERE session_id = NEW.session_id
    AND staff_id = NEW.logged_for_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tutor_log_logged_for_staff_must_be_assigned';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_tutor_log_provenance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_tutor_log_provenance()
  TO service_role, postgres;

DO $migration$
DECLARE
  create_source TEXT;
  updated_create_source TEXT;
  update_source TEXT;
  updated_update_source TEXT;
BEGIN
  SELECT prosrc
  INTO create_source
  FROM pg_proc
  WHERE oid = 'public.create_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure;

  updated_create_source := replace(
    create_source,
    $remove$
  IF v_session_type = 'CHECK_IN'
     AND v_assignment_type NOT IN ('CHECK_IN_HOST', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only a conducting staff member can log a check-in'
    );
  END IF;
$remove$,
    ''
  );

  IF updated_create_source = create_source THEN
    RAISE EXCEPTION 'create_tutor_log check-in guard was not found';
  END IF;

  EXECUTE format(
    $ddl$
CREATE OR REPLACE FUNCTION public.create_tutor_log(
  p_session_id UUID,
  p_created_by UUID,
  p_logged_for_staff_id UUID,
  p_staff_attendance JSONB DEFAULT '[]'::JSONB,
  p_student_attendance JSONB DEFAULT '[]'::JSONB,
  p_topics JSONB DEFAULT '[]'::JSONB,
  p_topic_files JSONB DEFAULT '[]'::JSONB,
  p_notes JSONB DEFAULT '[]'::JSONB,
  p_parent_attendance JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS %L
$ddl$,
    updated_create_source
  );

  SELECT prosrc
  INTO update_source
  FROM pg_proc
  WHERE oid = 'public.update_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure;

  updated_update_source := replace(
    update_source,
    $remove$
  IF v_session_type = 'CHECK_IN'
     AND v_assignment_type NOT IN ('CHECK_IN_HOST', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only a conducting staff member can log a check-in'
    );
  END IF;
$remove$,
    ''
  );

  IF updated_update_source = update_source THEN
    RAISE EXCEPTION 'update_tutor_log check-in guard was not found';
  END IF;

  EXECUTE format(
    $ddl$
CREATE OR REPLACE FUNCTION public.update_tutor_log(
  p_tutor_log_id UUID,
  p_updated_by UUID,
  p_logged_for_staff_id UUID,
  p_staff_attendance JSONB DEFAULT '[]'::JSONB,
  p_student_attendance JSONB DEFAULT '[]'::JSONB,
  p_parent_attendance JSONB DEFAULT '[]'::JSONB,
  p_topics JSONB DEFAULT '[]'::JSONB,
  p_topic_files JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS %L
$ddl$,
    updated_update_source
  );
END;
$migration$;

COMMENT ON FUNCTION public.create_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
) IS
  'Atomically creates a tutor log with immutable actual submitter provenance and separate assigned-staff operational attribution. Check-in role authorization is enforced by the calling portal.';

COMMENT ON FUNCTION public.update_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB
) IS
  'Atomically replaces tutor-log detail records, preserves the original submitter, and records the actual admin editor. Check-in role authorization is enforced by the calling portal.';
