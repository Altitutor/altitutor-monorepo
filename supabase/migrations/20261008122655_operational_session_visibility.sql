-- Ordinary schedules/selectors use operational facades. The existing assigned
-- facades remain available for explicit log/payment history after cancellation.
-- Like the underlying role facades, these are definer views because tutors and
-- students have no base-table row access. Authorization remains the underlying
-- facade's current_tutor_id/current_student_id predicate, not client filtering.
CREATE VIEW public.vtutor_operational_sessions
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vtutor_sessions facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

CREATE VIEW public.vtutor_operational_session_detail
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vtutor_session_detail facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

CREATE VIEW public.vtutor_operational_sessions_students
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vtutor_sessions_students facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

CREATE VIEW public.vstudent_operational_sessions
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vstudent_sessions facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

CREATE VIEW public.vstudent_operational_session_detail
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vstudent_session_detail facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

CREATE VIEW public.vstudent_operational_session_base
WITH (security_invoker = false, security_barrier = true) AS
SELECT facade.* FROM public.vstudent_session_base facade
JOIN public.sessions session ON session.id = facade.session_id
WHERE session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL;

REVOKE ALL ON public.vtutor_operational_sessions,
  public.vtutor_operational_session_detail, public.vtutor_operational_sessions_students,
  public.vstudent_operational_sessions, public.vstudent_operational_session_detail,
  public.vstudent_operational_session_base FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vtutor_operational_sessions,
  public.vtutor_operational_session_detail, public.vtutor_operational_sessions_students,
  public.vstudent_operational_sessions, public.vstudent_operational_session_detail,
  public.vstudent_operational_session_base TO authenticated, service_role;

COMMENT ON VIEW public.vtutor_operational_sessions IS
  'Assigned tutor operational sessions, including active past/trial/non-billable sessions; excludes inactive and cancellation tombstones.';
COMMENT ON VIEW public.vstudent_operational_session_base IS
  'Student operational schedule: assigned sessions and discoverable Homework Help, ACTIVE without cancellation tombstones. Historical log/payment readers use explicit historical facades.';

-- Keep the existing search/pricing/relationship contracts intact. Only the
-- operational filter changes; explicit admin history can still include inactive
-- sessions. Fail migration rather than silently missing a changed query seam.
DO $migration$
DECLARE
  definition text;
  status_filter text := 'AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))';
BEGIN
  SELECT pg_get_functiondef(oid) INTO STRICT definition
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'search_sessions_admin';
  IF strpos(definition, status_filter) = 0 THEN
    RAISE EXCEPTION 'search_sessions_admin status filter changed; review operational lifecycle migration';
  END IF;
  EXECUTE replace(definition, status_filter, status_filter || E'\n      AND (s.calendar_tombstone_until IS NULL OR p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR ''INACTIVE'' = ANY(p_statuses))');

  SELECT pg_get_functiondef('public.get_available_reschedule_sessions(uuid,uuid,integer)'::regprocedure) INTO definition;
  IF strpos(definition, 'AND s.status = ''ACTIVE''') = 0 THEN
    RAISE EXCEPTION 'get_available_reschedule_sessions status filter changed; review operational lifecycle migration';
  END IF;
  EXECUTE replace(definition, 'AND s.status = ''ACTIVE''',
    'AND s.status = ''ACTIVE'' AND s.calendar_tombstone_until IS NULL');
END;
$migration$;

-- Protect stale absence selections at the shared command boundary. Undo and
-- historical corrections keep their existing path. Lock sessions in ID order
-- so cancellation cannot race with the subsequent atomic attendance changes.
CREATE OR REPLACE FUNCTION private.run_absence_lifecycle_operation(
  operation_kind text, operation_function text, operations jsonb, actor_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  previous_operation text := current_setting('app.absence_lifecycle_operation', true);
  result jsonb;
  target_session record;
BEGIN
  IF operation_function IN ('log_staff_absences_rows', 'log_student_absences_rows', 'log_student_absences_self_rows')
     AND jsonb_typeof(operations) = 'array' THEN
    FOR target_session IN
      SELECT session.id, session.status, session.calendar_tombstone_until
      FROM public.sessions session
      WHERE session.id IN (
        SELECT assignment.session_id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions_students assignment
          ON assignment.id::text = operation->>'original_sessions_students_id'
        UNION
        SELECT assignment.session_id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions_staff assignment
          ON assignment.id::text = operation->>'original_sessions_staff_id'
        UNION
        SELECT replacement.id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions replacement ON replacement.id::text = operation->>'target_session_id'
      )
      ORDER BY session.id FOR SHARE
    LOOP
      IF target_session.status <> 'ACTIVE' OR target_session.calendar_tombstone_until IS NOT NULL THEN
        RETURN jsonb_build_object('success', false,
          'error', 'Cannot change attendance for an inactive or cancelled session.');
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.absence_lifecycle_operation', operation_kind, true);
  EXECUTE format('SELECT private.%I($1, $2)', operation_function)
    INTO result USING operations, actor_id;
  PERFORM set_config('app.absence_lifecycle_operation', COALESCE(previous_operation, ''), true);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.absence_lifecycle_operation', COALESCE(previous_operation, ''), true);
  RAISE;
END;
$function$;
REVOKE ALL ON FUNCTION private.run_absence_lifecycle_operation(text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Final-session selections also enforce operational lifecycle at commit.
CREATE OR REPLACE FUNCTION public.complete_student_exit_request(
  p_form_token_id uuid,
  p_student_id uuid,
  p_submitted_by_user_id uuid,
  p_response_json jsonb,
  p_answers jsonb,
  p_exit_selections jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.student_exit_requests%ROWTYPE;
  v_token public.form_tokens%ROWTYPE;
  v_response_id uuid;
  v_answer jsonb;
  v_selection jsonb;
  v_target_count integer;
  v_selection_count integer;
  v_discontinue_result jsonb;
  v_scheduled boolean := false;
BEGIN
  SELECT * INTO v_request
  FROM public.student_exit_requests
  WHERE form_token_id = p_form_token_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'This exit request is no longer active.');
  END IF;
  IF v_request.student_id <> p_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'This exit request belongs to another student.');
  END IF;
  IF v_request.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'response_id', v_request.form_response_id);
  END IF;
  IF v_request.status <> 'pending' OR (v_request.expires_at IS NOT NULL AND v_request.expires_at <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This exit request is no longer active.');
  END IF;

  SELECT * INTO v_token
  FROM public.form_tokens
  WHERE id = p_form_token_id
  FOR UPDATE;
  IF NOT FOUND OR v_token.revoked_at IS NOT NULL OR (v_token.expires_at IS NOT NULL AND v_token.expires_at <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This exit request is no longer active.');
  END IF;

  SELECT count(*) INTO v_target_count
  FROM public.student_exit_request_enrolments
  WHERE student_exit_request_id = v_request.id;

  SELECT count(*) INTO v_selection_count
  FROM jsonb_array_elements(COALESCE(p_exit_selections, '[]'::jsonb));

  IF v_target_count <> v_selection_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choose the final session for every class.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_exit_selections, '[]'::jsonb)) selection
    WHERE NULLIF(selection->>'requestEnrolmentId', '') IS NULL
      OR NULLIF(selection->>'finalSessionAt', '') IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choose the final session for every class.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_exit_selections, '[]'::jsonb)) selection
    LEFT JOIN public.student_exit_request_enrolments target
      ON target.id = (selection->>'requestEnrolmentId')::uuid
     AND target.student_exit_request_id = v_request.id
    WHERE target.id IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or more selected classes do not belong to this request.');
  END IF;

  IF v_request.workflow_key = 'student_discontinuation'
     AND (
       SELECT count(*)
       FROM public.classes_students cs
       WHERE cs.student_id = p_student_id
         AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > now())
     ) <> v_target_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'The student''s active classes changed. Ask staff to create a new discontinuation link.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_exit_request_enrolments target
    JOIN public.classes_students cs ON cs.id = target.classes_students_id
    WHERE target.student_exit_request_id = v_request.id
      AND (cs.student_id <> p_student_id OR (cs.unenrolled_at IS NOT NULL AND cs.unenrolled_at <= now()))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or more selected classes are no longer active.');
  END IF;

  -- Revalidate and lock final-session choices at completion, not just in the
  -- HTTP offered-set query. Timestamp-only older clients remain compatible.
  FOR v_selection IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_exit_selections, '[]'::jsonb))
  LOOP
    PERFORM session.id
    FROM public.sessions session
    JOIN public.classes_students enrollment ON enrollment.class_id = session.class_id
    JOIN public.student_exit_request_enrolments target ON target.classes_students_id = enrollment.id
    WHERE target.id = (v_selection->>'requestEnrolmentId')::uuid
      AND target.student_exit_request_id = v_request.id
      AND session.start_at = (v_selection->>'finalSessionAt')::timestamptz
      AND session.status = 'ACTIVE'
      AND session.calendar_tombstone_until IS NULL
    ORDER BY session.id LIMIT 1 FOR SHARE OF session;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false,
        'error', 'One of the selected sessions is no longer available.');
    END IF;
  END LOOP;

  FOR v_selection IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_exit_selections, '[]'::jsonb))
  LOOP
    UPDATE public.student_exit_request_enrolments
    SET final_session_at = (v_selection->>'finalSessionAt')::timestamptz,
        unenrolled_at = (
          ((v_selection->>'finalSessionAt')::timestamptz AT TIME ZONE 'Australia/Adelaide')::date + 1
        )::timestamp AT TIME ZONE 'Australia/Adelaide'
    WHERE id = (v_selection->>'requestEnrolmentId')::uuid
      AND student_exit_request_id = v_request.id;
  END LOOP;

  INSERT INTO public.form_responses (
    form_id, form_version_id, form_token_id, respondent_type, respondent_student_id,
    subject_type, subject_student_id, submitted_by_user_id, response_json
  ) VALUES (
    v_request.form_id, v_request.form_version_id, p_form_token_id, 'student', p_student_id,
    'student', p_student_id, p_submitted_by_user_id, p_response_json
  ) RETURNING id INTO v_response_id;

  FOR v_answer IN SELECT value FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) LOOP
    INSERT INTO public.form_response_answers (
      form_response_id, form_id, form_version_id, question_id, question_label_snapshot,
      question_type, choice_value, choice_label_snapshot, choice_values, text_value, number_value
    ) VALUES (
      v_response_id, v_request.form_id, v_request.form_version_id,
      v_answer->>'questionId', v_answer->>'questionLabelSnapshot', v_answer->>'questionType',
      NULLIF(v_answer->>'choiceValue', ''), NULLIF(v_answer->>'choiceLabelSnapshot', ''),
      CASE WHEN v_answer->'choiceValues' IS NULL OR v_answer->'choiceValues' = 'null'::jsonb THEN NULL ELSE v_answer->'choiceValues' END,
      NULLIF(v_answer->>'textValue', ''), NULLIF(v_answer->>'numberValue', '')::numeric
    );
  END LOOP;

  PERFORM set_config('app.completing_student_exit_request', 'true', true);
  UPDATE public.classes_students cs
  SET unenrolled_at = target.unenrolled_at,
      unenrolled_by = v_request.requested_by
  FROM public.student_exit_request_enrolments target
  WHERE target.student_exit_request_id = v_request.id
    AND cs.id = target.classes_students_id
    AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > now());

  UPDATE public.student_exit_requests
  SET status = 'completed', completed_at = now(), form_response_id = v_response_id
  WHERE id = v_request.id;

  IF v_request.workflow_key = 'student_discontinuation' THEN
    v_scheduled := EXISTS (
      SELECT 1 FROM public.classes_students
      WHERE student_id = p_student_id
        AND (unenrolled_at IS NULL OR unenrolled_at > now())
    );
    IF NOT v_scheduled THEN
      SELECT public.discontinue_student(p_student_id, v_request.requested_by) INTO v_discontinue_result;
      IF NOT COALESCE((v_discontinue_result->>'success')::boolean, false) THEN
        RAISE EXCEPTION '%', COALESCE(v_discontinue_result->>'error', 'Could not discontinue student');
      END IF;
    END IF;
  ELSE
    v_scheduled := EXISTS (
      SELECT 1 FROM public.student_exit_request_enrolments
      WHERE student_exit_request_id = v_request.id AND unenrolled_at > now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'response_id', v_response_id, 'scheduled', v_scheduled);
END;
$$;
