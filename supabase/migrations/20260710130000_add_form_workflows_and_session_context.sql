CREATE TYPE public.form_workflow_key AS ENUM ('student_unenrolment', 'student_discontinuation');
CREATE TYPE public.student_exit_request_status AS ENUM ('pending', 'completed', 'revoked');

ALTER TABLE public.forms
  ADD COLUMN workflow_key public.form_workflow_key NULL,
  ADD COLUMN workflow_request_expiry_days integer NULL,
  ADD CONSTRAINT forms_workflow_request_expiry_days_positive
    CHECK (workflow_request_expiry_days IS NULL OR workflow_request_expiry_days > 0);

CREATE UNIQUE INDEX forms_workflow_key_unique_idx
  ON public.forms(workflow_key)
  WHERE workflow_key IS NOT NULL AND archived_at IS NULL;

ALTER TABLE public.form_responses
  ADD COLUMN session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX form_responses_session_id_idx
  ON public.form_responses(session_id)
  WHERE session_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.student_exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key public.form_workflow_key NOT NULL,
  status public.student_exit_request_status NOT NULL DEFAULT 'pending',
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE RESTRICT,
  form_version_id uuid NOT NULL REFERENCES public.form_versions(id) ON DELETE RESTRICT,
  form_token_id uuid NOT NULL REFERENCES public.form_tokens(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  form_response_id uuid NULL REFERENCES public.form_responses(id) ON DELETE SET NULL,
  expires_at timestamptz NULL,
  completed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  revoke_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_exit_requests_completed_state CHECK (
    (status = 'completed') = (completed_at IS NOT NULL)
  ),
  CONSTRAINT student_exit_requests_revoked_state CHECK (
    (status = 'revoked') = (revoked_at IS NOT NULL)
  )
);

CREATE TABLE public.student_exit_request_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_exit_request_id uuid NOT NULL REFERENCES public.student_exit_requests(id) ON DELETE CASCADE,
  classes_students_id uuid NOT NULL REFERENCES public.classes_students(id) ON DELETE RESTRICT,
  final_session_at timestamptz NOT NULL,
  unenrolled_at timestamptz NOT NULL,
  CONSTRAINT student_exit_request_enrolments_unique UNIQUE (student_exit_request_id, classes_students_id),
  CONSTRAINT student_exit_request_enrolments_order CHECK (unenrolled_at > final_session_at)
);

CREATE INDEX student_exit_requests_student_status_idx
  ON public.student_exit_requests(student_id, status, created_at DESC);
CREATE INDEX student_exit_request_enrolments_enrolment_idx
  ON public.student_exit_request_enrolments(classes_students_id);

ALTER TABLE public.student_exit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exit_request_enrolments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to student_exit_requests" ON public.student_exit_requests
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF full access to student_exit_request_enrolments" ON public.student_exit_request_enrolments
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Seed two independently editable workflow forms. No public token is created: requests mint one-use authenticated tokens.
WITH seed_forms AS (
  INSERT INTO public.forms (
    name, purpose, workflow_key, access_type, submission_limit, draft_blocks,
    draft_thank_you_message, status
  )
  VALUES
    (
      'Class Unenrolment', 'unenrolment', 'student_unenrolment', 'authenticated', 'one_per_token',
      $$[
        {"id":"exit_reason","type":"multi_select","title":"Why have you chosen to discontinue?","required":true,"options":[
          {"id":"not_useful","label":"I didn't find the tutoring useful","value":"not_useful"},
          {"id":"another_service","label":"Found another tutoring service","value":"another_service"},
          {"id":"subjects","label":"You don't offer the subject(s) I want to study","value":"subjects"},
          {"id":"too_expensive","label":"The tutoring was too expensive","value":"too_expensive"},
          {"id":"availability","label":"We didn't offer sessions on day(s) you were available","value":"availability"},
          {"id":"other","label":"Other","value":"other","allowOtherText":true}
        ]},
        {"id":"exit_reason_detail","type":"long_text","title":"Please explain your answer to the above question","required":false},
        {"id":"service_improvements","type":"multi_select","title":"What aspects of our service could be improved?","required":true,"options":[
          {"id":"teaching_quality","label":"Teaching quality","value":"teaching_quality"},
          {"id":"resources","label":"Resources (notes, practice questions, tests, etc.)","value":"resources"},
          {"id":"availability","label":"Availability","value":"availability"},
          {"id":"other","label":"Other","value":"other","allowOtherText":true}
        ]},
        {"id":"service_improvements_detail","type":"long_text","title":"Please explain your answer to the above question","required":false}
      ]$$::jsonb,
      'Thanks for sharing your feedback. Your unenrolment has been processed.', 'published'
    ),
    (
      'Student Discontinuation', 'discontinuation', 'student_discontinuation', 'authenticated', 'one_per_token',
      $$[
        {"id":"exit_reason","type":"multi_select","title":"Why have you chosen to discontinue?","required":true,"options":[
          {"id":"not_useful","label":"I didn't find the tutoring useful","value":"not_useful"},
          {"id":"another_service","label":"Found another tutoring service","value":"another_service"},
          {"id":"subjects","label":"You don't offer the subject(s) I want to study","value":"subjects"},
          {"id":"too_expensive","label":"The tutoring was too expensive","value":"too_expensive"},
          {"id":"availability","label":"We didn't offer sessions on day(s) you were available","value":"availability"},
          {"id":"other","label":"Other","value":"other","allowOtherText":true}
        ]},
        {"id":"exit_reason_detail","type":"long_text","title":"Please explain your answer to the above question","required":false},
        {"id":"service_improvements","type":"multi_select","title":"What aspects of our service could be improved?","required":true,"options":[
          {"id":"teaching_quality","label":"Teaching quality","value":"teaching_quality"},
          {"id":"resources","label":"Resources (notes, practice questions, tests, etc.)","value":"resources"},
          {"id":"availability","label":"Availability","value":"availability"},
          {"id":"other","label":"Other","value":"other","allowOtherText":true}
        ]},
        {"id":"service_improvements_detail","type":"long_text","title":"Please explain your answer to the above question","required":false}
      ]$$::jsonb,
      'Thanks for sharing your feedback. Your discontinuation has been scheduled.', 'published'
    )
  RETURNING id, draft_blocks, draft_thank_you_message
), seed_versions AS (
  INSERT INTO public.form_versions (form_id, version_number, blocks, thank_you_message)
  SELECT id, 1, draft_blocks, draft_thank_you_message FROM seed_forms
  RETURNING id, form_id
)
UPDATE public.forms forms
SET latest_published_version_id = seed_versions.id
FROM seed_versions
WHERE forms.id = seed_versions.form_id;

-- A data-modifying CTE cannot reliably update its own INSERT target in the
-- same statement snapshot. Make the seeded published version explicit.
UPDATE public.forms forms
SET latest_published_version_id = versions.id
FROM public.form_versions versions
WHERE forms.workflow_key IS NOT NULL
  AND forms.latest_published_version_id IS NULL
  AND versions.form_id = forms.id
  AND versions.version_number = 1;

COMMENT ON COLUMN public.forms.workflow_key IS 'Optional hard-coded workflow slot assigned to this form. Workflow behaviour remains implemented in application code.';
COMMENT ON COLUMN public.form_responses.session_id IS 'Optional session context for a response recorded during that session.';
COMMENT ON TABLE public.student_exit_requests IS 'One-time authenticated student request to submit a form before scheduled unenrolment or discontinuation.';

-- The form response, scheduled class exits and request state must commit together.  This
-- function is deliberately not exposed to normal API callers: the student route validates
-- the signed-in student before calling it with the server service role.
CREATE OR REPLACE FUNCTION public.complete_student_exit_request(
  p_form_token_id uuid,
  p_student_id uuid,
  p_submitted_by_user_id uuid,
  p_response_json jsonb,
  p_answers jsonb
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
  v_enrolment record;
  v_answer jsonb;
  v_final_exit_at timestamptz;
  v_discontinue_result jsonb;
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

  SELECT * INTO v_token FROM public.form_tokens WHERE id = p_form_token_id FOR UPDATE;
  IF NOT FOUND OR v_token.revoked_at IS NOT NULL OR (v_token.expires_at IS NOT NULL AND v_token.expires_at <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This exit request is no longer active.');
  END IF;

  FOR v_enrolment IN
    SELECT ere.classes_students_id, ere.unenrolled_at
    FROM public.student_exit_request_enrolments ere
    JOIN public.classes_students cs ON cs.id = ere.classes_students_id
    WHERE ere.student_exit_request_id = v_request.id
      AND cs.student_id = p_student_id
      AND cs.unenrolled_at IS NULL
    FOR UPDATE OF cs
  LOOP
    NULL;
  END LOOP;
  IF (SELECT count(*) FROM public.student_exit_request_enrolments WHERE student_exit_request_id = v_request.id)
     <> (SELECT count(*) FROM public.student_exit_request_enrolments ere JOIN public.classes_students cs ON cs.id = ere.classes_students_id WHERE ere.student_exit_request_id = v_request.id AND cs.student_id = p_student_id AND cs.unenrolled_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or more selected classes are no longer active.');
  END IF;

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
      CASE WHEN v_answer->'choiceValues' IS NULL OR v_answer->'choiceValues' = 'null'::jsonb THEN NULL ELSE v_answer->'choiceValues' END, NULLIF(v_answer->>'textValue', ''),
      NULLIF(v_answer->>'numberValue', '')::numeric
    );
  END LOOP;

  PERFORM set_config('app.completing_student_exit_request', 'true', true);
  UPDATE public.classes_students cs
  SET unenrolled_at = ere.unenrolled_at, unenrolled_by = v_request.requested_by
  FROM public.student_exit_request_enrolments ere
  WHERE ere.student_exit_request_id = v_request.id
    AND cs.id = ere.classes_students_id
    AND cs.unenrolled_at IS NULL;

  UPDATE public.student_exit_requests
  SET status = 'completed', completed_at = now(), form_response_id = v_response_id
  WHERE id = v_request.id;

  SELECT max(unenrolled_at) INTO v_final_exit_at
  FROM public.student_exit_request_enrolments WHERE student_exit_request_id = v_request.id;
  IF v_request.workflow_key = 'student_discontinuation' AND v_final_exit_at <= now() THEN
    SELECT public.discontinue_student(p_student_id, v_request.requested_by) INTO v_discontinue_result;
    IF NOT COALESCE((v_discontinue_result->>'success')::boolean, false) THEN
      RAISE EXCEPTION '%', COALESCE(v_discontinue_result->>'error', 'Could not discontinue student');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'response_id', v_response_id, 'scheduled', v_final_exit_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_exit_request(uuid, uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_exit_request(uuid, uuid, uuid, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_scheduled_student_discontinuations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_count integer := 0;
  v_result jsonb;
BEGIN
  FOR v_request IN
    SELECT r.student_id, r.requested_by
    FROM public.student_exit_requests r
    WHERE r.workflow_key = 'student_discontinuation'
      AND r.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.student_exit_request_enrolments ere
        WHERE ere.student_exit_request_id = r.id AND ere.unenrolled_at > now()
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.classes_students cs
        WHERE cs.student_id = r.student_id AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > now())
      )
      AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = r.student_id AND s.discontinued_at IS NULL)
  LOOP
    SELECT public.discontinue_student(v_request.student_id, v_request.requested_by) INTO v_result;
    IF COALESCE((v_result->>'success')::boolean, false) THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_scheduled_student_discontinuations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scheduled_student_discontinuations() TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_pending_exit_requests_for_enrolment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unenrolled_at IS NOT NULL
     AND OLD.unenrolled_at IS NULL
     AND current_setting('app.completing_student_exit_request', true) IS DISTINCT FROM 'true' THEN
    UPDATE public.student_exit_requests r
    SET status = 'revoked', revoked_at = now(), revoke_reason = 'Class was manually unenrolled'
    FROM public.student_exit_request_enrolments ere
    WHERE ere.student_exit_request_id = r.id
      AND ere.classes_students_id = NEW.id
      AND r.status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS revoke_pending_exit_requests_on_manual_unenrolment ON public.classes_students;
CREATE TRIGGER revoke_pending_exit_requests_on_manual_unenrolment
AFTER UPDATE OF unenrolled_at ON public.classes_students
FOR EACH ROW EXECUTE FUNCTION public.revoke_pending_exit_requests_for_enrolment();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'apply-scheduled-student-discontinuations';
    PERFORM cron.schedule('apply-scheduled-student-discontinuations', '5 * * * *', 'SELECT public.apply_scheduled_student_discontinuations()');
  END IF;
END;
$$;
