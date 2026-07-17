DROP TRIGGER IF EXISTS complete_no_class_discontinuation_request ON public.student_exit_requests;
DROP FUNCTION IF EXISTS public.complete_no_class_discontinuation_request();
DROP FUNCTION IF EXISTS public.complete_student_exit_request(uuid, uuid, uuid, jsonb, jsonb);

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

REVOKE ALL ON FUNCTION public.complete_student_exit_request(uuid, uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_exit_request(uuid, uuid, uuid, jsonb, jsonb, jsonb) TO service_role;
