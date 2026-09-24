-- Separate immutable submission provenance from the staff member for whom a
-- tutor log is operationally attributed. Historical created_by values were
-- overloaded, so preserve them as logged_for_staff_id and leave the original
-- submitter unknown rather than inventing audit history.

ALTER TABLE public.tutor_logs
  ADD COLUMN logged_for_staff_id UUID REFERENCES public.staff(id),
  ADD COLUMN updated_by UUID REFERENCES public.staff(id);

ALTER TABLE public.tutor_logs
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.tutor_logs DISABLE TRIGGER set_updated_at_tutor_logs;

UPDATE public.tutor_logs
SET logged_for_staff_id = created_by,
    created_by = NULL;

ALTER TABLE public.tutor_logs ENABLE TRIGGER set_updated_at_tutor_logs;

CREATE INDEX tutor_logs_logged_for_staff_id_idx
  ON public.tutor_logs (logged_for_staff_id)
  WHERE logged_for_staff_id IS NOT NULL;

CREATE INDEX tutor_logs_updated_by_idx
  ON public.tutor_logs (updated_by)
  WHERE updated_by IS NOT NULL;

COMMENT ON COLUMN public.tutor_logs.created_by IS
  'Immutable staff member who actually submitted the log. NULL means the submitter is unknowable for legacy data.';
COMMENT ON COLUMN public.tutor_logs.logged_for_staff_id IS
  'Operational attribution: the staff member assigned to the session for whom the log is recorded.';
COMMENT ON COLUMN public.tutor_logs.updated_by IS
  'Staff member who most recently edited the log; NULL until the first edit.';

CREATE OR REPLACE FUNCTION public.enforce_tutor_log_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  session_type TEXT;
  assignment_type TEXT;
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

  SELECT s.type, ss.type
  INTO session_type, assignment_type
  FROM public.sessions s
  LEFT JOIN public.sessions_staff ss
    ON ss.session_id = s.id
   AND ss.staff_id = NEW.logged_for_staff_id
  WHERE s.id = NEW.session_id;

  IF assignment_type IS NULL THEN
    RAISE EXCEPTION 'tutor_log_logged_for_staff_must_be_assigned';
  END IF;

  IF session_type = 'CHECK_IN'
     AND assignment_type NOT IN ('CHECK_IN_HOST', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') THEN
    RAISE EXCEPTION 'tutor_log_check_in_must_be_logged_for_conducting_staff';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_tutor_log_provenance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_tutor_log_provenance()
  TO service_role, postgres;

CREATE TRIGGER enforce_tutor_log_provenance
BEFORE INSERT OR UPDATE OF created_by, logged_for_staff_id
ON public.tutor_logs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tutor_log_provenance();

CREATE OR REPLACE FUNCTION public.capture_tutor_log_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_entities JSONB;
BEGIN
  event_entities := jsonb_build_array(
    public.domain_event_entity('staff', NEW.logged_for_staff_id, 'logged_for')
  );

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_domain_event(
      p_event_name => 'session.tutor_log_created',
      p_subject_type => 'session',
      p_subject_id => NEW.session_id,
      p_entities => event_entities,
      p_payload => jsonb_build_object(
        'tutor_log_id', NEW.id,
        'logged_for_staff_id', NEW.logged_for_staff_id
      ),
      p_effective_at => NEW.created_at,
      p_actor_staff_id => NEW.created_by,
      p_idempotency_key => 'tutor-log:' || NEW.id::TEXT || ':created'
    );
  ELSE
    PERFORM public.record_domain_event(
      p_event_name => 'session.tutor_log_updated',
      p_subject_type => 'session',
      p_subject_id => NEW.session_id,
      p_entities => event_entities,
      p_payload => jsonb_build_object(
        'tutor_log_id', NEW.id,
        'previous_logged_for_staff_id', OLD.logged_for_staff_id,
        'logged_for_staff_id', NEW.logged_for_staff_id
      ),
      p_effective_at => NEW.updated_at,
      p_actor_staff_id => NEW.updated_by
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_tutor_log_domain_event()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_tutor_log_domain_event()
  TO service_role, postgres;

CREATE TRIGGER capture_tutor_log_domain_event
AFTER INSERT OR UPDATE
ON public.tutor_logs
FOR EACH ROW
EXECUTE FUNCTION public.capture_tutor_log_domain_event();

DROP FUNCTION public.create_tutor_log(
  UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
);

CREATE FUNCTION public.create_tutor_log(
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
AS $function$
DECLARE
  v_tutor_log_id UUID;
  v_topic_id UUID;
  v_topic_file_id UUID;
  v_staff_attendance_item JSONB;
  v_student_attendance_item JSONB;
  v_parent_attendance_item JSONB;
  v_topic_item JSONB;
  v_topic_file_item JSONB;
  v_note_item TEXT;
  v_student_id UUID;
  v_student_status TEXT;
  v_student_was_trial BOOLEAN;
  v_staff_id UUID;
  v_staff_status TEXT;
  v_staff_was_trial BOOLEAN;
  v_parent_id UUID;
  v_staff_attendance_jsonb JSONB;
  v_student_attendance_jsonb JSONB;
  v_parent_attendance_jsonb JSONB;
  v_topics_jsonb JSONB;
  v_topic_files_jsonb JSONB;
  v_notes_jsonb JSONB;
  v_created_by_user_id UUID;
  v_created_by_role TEXT;
  v_created_by_status TEXT;
  v_session_type TEXT;
  v_assignment_type TEXT;
BEGIN
  SELECT type INTO v_session_type
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session does not exist');
  END IF;

  SELECT user_id, role, status
  INTO v_created_by_user_id, v_created_by_role, v_created_by_status
  FROM public.staff
  WHERE id = p_created_by;

  IF v_created_by_user_id IS NULL
     OR v_created_by_status <> 'ACTIVE'
     OR v_created_by_role NOT IN ('ADMINSTAFF', 'TUTOR') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid submitting staff member');
  END IF;

  SELECT type INTO v_assignment_type
  FROM public.sessions_staff
  WHERE session_id = p_session_id
    AND staff_id = p_logged_for_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'The staff member logged for must be assigned to the session'
    );
  END IF;

  IF v_session_type = 'CHECK_IN'
     AND v_assignment_type NOT IN ('CHECK_IN_HOST', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only a conducting staff member can log a check-in'
    );
  END IF;

  IF v_created_by_role = 'TUTOR' AND p_created_by <> p_logged_for_staff_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tutors can only submit logs for themselves'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.tutor_logs WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tutor log already exists for this session'
    );
  END IF;

  -- Service-role callers have no JWT. Set the real submitter as the transaction
  -- actor so existing child-record activity triggers resolve the same person.
  PERFORM set_config('request.jwt.claim.sub', v_created_by_user_id::TEXT, TRUE);

  v_staff_attendance_jsonb := COALESCE(p_staff_attendance, '[]'::JSONB);
  v_student_attendance_jsonb := COALESCE(p_student_attendance, '[]'::JSONB);
  v_parent_attendance_jsonb := COALESCE(p_parent_attendance, '[]'::JSONB);
  v_topics_jsonb := COALESCE(p_topics, '[]'::JSONB);
  v_topic_files_jsonb := COALESCE(p_topic_files, '[]'::JSONB);
  v_notes_jsonb := COALESCE(p_notes, '[]'::JSONB);

  INSERT INTO public.tutor_logs (
    id,
    session_id,
    created_by,
    logged_for_staff_id
  ) VALUES (
    gen_random_uuid(),
    p_session_id,
    p_created_by,
    p_logged_for_staff_id
  )
  RETURNING id INTO v_tutor_log_id;

  FOR v_staff_attendance_item IN
    SELECT value FROM jsonb_array_elements(v_staff_attendance_jsonb)
  LOOP
    v_staff_id := (v_staff_attendance_item->>'staffId')::UUID;
    SELECT status INTO v_staff_status FROM public.staff WHERE id = v_staff_id;
    v_staff_was_trial := v_staff_status = 'TRIAL';

    INSERT INTO public.tutor_logs_staff_attendance (
      id, tutor_log_id, staff_id, attended, type, was_trial
    ) VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      v_staff_id,
      (v_staff_attendance_item->>'attended')::BOOLEAN,
      v_staff_attendance_item->>'type',
      v_staff_was_trial
    )
    ON CONFLICT (tutor_log_id, staff_id) DO NOTHING;
  END LOOP;

  FOR v_student_attendance_item IN
    SELECT value FROM jsonb_array_elements(v_student_attendance_jsonb)
  LOOP
    v_student_id := (v_student_attendance_item->>'studentId')::UUID;
    SELECT status INTO v_student_status FROM public.students WHERE id = v_student_id;
    v_student_was_trial := v_student_status = 'TRIAL';

    INSERT INTO public.tutor_logs_student_attendance (
      id, tutor_log_id, student_id, attended, was_trial, created_by
    ) VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      v_student_id,
      (v_student_attendance_item->>'attended')::BOOLEAN,
      v_student_was_trial,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  FOR v_parent_attendance_item IN
    SELECT value FROM jsonb_array_elements(v_parent_attendance_jsonb)
  LOOP
    v_parent_id := (v_parent_attendance_item->>'parentId')::UUID;
    INSERT INTO public.tutor_logs_parent_attendance (
      id, tutor_log_id, parent_id, attended, created_by
    ) VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      v_parent_id,
      (v_parent_attendance_item->>'attended')::BOOLEAN,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, parent_id) DO NOTHING;
  END LOOP;

  FOR v_topic_item IN SELECT value FROM jsonb_array_elements(v_topics_jsonb)
  LOOP
    INSERT INTO public.tutor_logs_topics (id, tutor_log_id, topic_id, created_by)
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_item->>'topicId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topic_id) DO UPDATE SET id = tutor_logs_topics.id
    RETURNING id INTO v_topic_id;

    FOR v_student_id IN
      SELECT value::TEXT::UUID FROM jsonb_array_elements_text(v_topic_item->'studentIds')
    LOOP
      INSERT INTO public.tutor_logs_topics_students (
        id, tutor_logs_topics_id, student_id, created_by
      ) VALUES (gen_random_uuid(), v_topic_id, v_student_id, p_created_by)
      ON CONFLICT (tutor_logs_topics_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  FOR v_topic_file_item IN SELECT value FROM jsonb_array_elements(v_topic_files_jsonb)
  LOOP
    INSERT INTO public.tutor_logs_topics_files (
      id, tutor_log_id, topics_files_id, created_by
    ) VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_file_item->>'topicsFilesId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topics_files_id)
    DO UPDATE SET id = tutor_logs_topics_files.id
    RETURNING id INTO v_topic_file_id;

    FOR v_student_id IN
      SELECT value::TEXT::UUID
      FROM jsonb_array_elements_text(v_topic_file_item->'studentIds')
    LOOP
      INSERT INTO public.tutor_logs_topics_files_students (
        id, tutor_logs_topics_files_id, student_id, created_by
      ) VALUES (gen_random_uuid(), v_topic_file_id, v_student_id, p_created_by)
      ON CONFLICT (tutor_logs_topics_files_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  FOR v_note_item IN SELECT value FROM jsonb_array_elements_text(v_notes_jsonb)
  LOOP
    INSERT INTO public.notes (id, target_type, target_id, note, created_by)
    VALUES (
      gen_random_uuid(),
      'sessions',
      p_session_id,
      public.migrate_text_to_tiptap_jsonb(v_note_item),
      p_created_by
    );
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'tutor_log_id', v_tutor_log_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
) TO service_role, postgres;

COMMENT ON FUNCTION public.create_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
) IS
  'Atomically creates a tutor log with immutable actual submitter provenance and separate assigned-staff operational attribution.';

CREATE FUNCTION public.update_tutor_log(
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
AS $function$
DECLARE
  v_session_id UUID;
  v_session_type TEXT;
  v_updated_by_user_id UUID;
  v_assignment_type TEXT;
  v_staff_item JSONB;
  v_student_item JSONB;
  v_parent_item JSONB;
  v_topic_item JSONB;
  v_topic_file_item JSONB;
  v_staff_id UUID;
  v_student_id UUID;
  v_topic_row_id UUID;
  v_topic_file_row_id UUID;
  v_staff_status TEXT;
  v_student_status TEXT;
BEGIN
  SELECT tl.session_id, session.type
  INTO v_session_id, v_session_type
  FROM public.tutor_logs tl
  JOIN public.sessions session ON session.id = tl.session_id
  WHERE tl.id = p_tutor_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Tutor log not found');
  END IF;

  SELECT user_id INTO v_updated_by_user_id
  FROM public.staff
  WHERE id = p_updated_by
    AND role = 'ADMINSTAFF'
    AND status = 'ACTIVE';

  IF v_updated_by_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid editing admin staff member');
  END IF;

  SELECT type INTO v_assignment_type
  FROM public.sessions_staff
  WHERE session_id = v_session_id
    AND staff_id = p_logged_for_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'The staff member logged for must be assigned to the session'
    );
  END IF;

  IF v_session_type = 'CHECK_IN'
     AND v_assignment_type NOT IN ('CHECK_IN_HOST', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only a conducting staff member can log a check-in'
    );
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_updated_by_user_id::TEXT, TRUE);

  DELETE FROM public.tutor_logs_topics_files_students child
  USING public.tutor_logs_topics_files parent
  WHERE child.tutor_logs_topics_files_id = parent.id
    AND parent.tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_topics_files
  WHERE tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_topics_students child
  USING public.tutor_logs_topics parent
  WHERE child.tutor_logs_topics_id = parent.id
    AND parent.tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_topics
  WHERE tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_student_attendance
  WHERE tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_parent_attendance
  WHERE tutor_log_id = p_tutor_log_id;

  DELETE FROM public.tutor_logs_staff_attendance
  WHERE tutor_log_id = p_tutor_log_id;

  FOR v_staff_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_staff_attendance, '[]'::JSONB))
  LOOP
    v_staff_id := (v_staff_item->>'staffId')::UUID;
    SELECT status INTO v_staff_status FROM public.staff WHERE id = v_staff_id;

    INSERT INTO public.tutor_logs_staff_attendance (
      id, tutor_log_id, staff_id, attended, type, was_trial
    ) VALUES (
      gen_random_uuid(),
      p_tutor_log_id,
      v_staff_id,
      (v_staff_item->>'attended')::BOOLEAN,
      v_staff_item->>'type',
      v_staff_status = 'TRIAL'
    )
    ON CONFLICT (tutor_log_id, staff_id) DO NOTHING;
  END LOOP;

  FOR v_student_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_student_attendance, '[]'::JSONB))
  LOOP
    v_student_id := (v_student_item->>'studentId')::UUID;
    SELECT status INTO v_student_status FROM public.students WHERE id = v_student_id;

    INSERT INTO public.tutor_logs_student_attendance (
      id, tutor_log_id, student_id, attended, was_trial, created_by
    ) VALUES (
      gen_random_uuid(),
      p_tutor_log_id,
      v_student_id,
      (v_student_item->>'attended')::BOOLEAN,
      v_student_status = 'TRIAL',
      p_updated_by
    )
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  FOR v_parent_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_parent_attendance, '[]'::JSONB))
  LOOP
    INSERT INTO public.tutor_logs_parent_attendance (
      id, tutor_log_id, parent_id, attended, created_by
    ) VALUES (
      gen_random_uuid(),
      p_tutor_log_id,
      (v_parent_item->>'parentId')::UUID,
      (v_parent_item->>'attended')::BOOLEAN,
      p_updated_by
    )
    ON CONFLICT (tutor_log_id, parent_id) DO NOTHING;
  END LOOP;

  FOR v_topic_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_topics, '[]'::JSONB))
  LOOP
    INSERT INTO public.tutor_logs_topics (id, tutor_log_id, topic_id, created_by)
    VALUES (
      gen_random_uuid(),
      p_tutor_log_id,
      (v_topic_item->>'topicId')::UUID,
      p_updated_by
    )
    RETURNING id INTO v_topic_row_id;

    FOR v_student_id IN
      SELECT value::TEXT::UUID FROM jsonb_array_elements_text(v_topic_item->'studentIds')
    LOOP
      INSERT INTO public.tutor_logs_topics_students (
        id, tutor_logs_topics_id, student_id, created_by
      ) VALUES (gen_random_uuid(), v_topic_row_id, v_student_id, p_updated_by);
    END LOOP;
  END LOOP;

  FOR v_topic_file_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_topic_files, '[]'::JSONB))
  LOOP
    INSERT INTO public.tutor_logs_topics_files (
      id, tutor_log_id, topics_files_id, created_by
    ) VALUES (
      gen_random_uuid(),
      p_tutor_log_id,
      (v_topic_file_item->>'topicsFilesId')::UUID,
      p_updated_by
    )
    RETURNING id INTO v_topic_file_row_id;

    FOR v_student_id IN
      SELECT value::TEXT::UUID
      FROM jsonb_array_elements_text(v_topic_file_item->'studentIds')
    LOOP
      INSERT INTO public.tutor_logs_topics_files_students (
        id, tutor_logs_topics_files_id, student_id, created_by
      ) VALUES (gen_random_uuid(), v_topic_file_row_id, v_student_id, p_updated_by);
    END LOOP;
  END LOOP;

  UPDATE public.tutor_logs
  SET logged_for_staff_id = p_logged_for_staff_id,
      updated_by = p_updated_by
  WHERE id = p_tutor_log_id;

  RETURN jsonb_build_object('success', TRUE, 'tutor_log_id', p_tutor_log_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB
) TO service_role, postgres;

COMMENT ON FUNCTION public.update_tutor_log(
  UUID, UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB
) IS
  'Atomically replaces tutor-log detail records, preserves the original submitter, and records the actual admin editor.';

CREATE OR REPLACE VIEW public.vtutor_tutor_log
WITH (security_invoker = false)
AS
SELECT
  tl.id AS tutor_log_id,
  tl.session_id,
  tl.created_at AS tutor_log_created_at,
  tl.updated_at AS tutor_log_updated_at,
  tl.created_by,
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'staff_id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'role', s.role,
      'status', s.status,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'attended', tlsa.attended,
      'type', tlsa.type
    ))
    FROM public.tutor_logs_staff_attendance tlsa
    JOIN public.staff s ON s.id = tlsa.staff_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS staff_attendance,
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'student_id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'attended', tlsa.attended
    ))
    FROM public.tutor_logs_student_attendance tlsa
    JOIN public.students st ON st.id = tlsa.student_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS student_attendance,
  (
    SELECT json_agg(json_build_object(
      'id', tlt.id,
      'topic_id', t.id,
      'topic_name', t.name,
      'topic_index', t.index,
      'parent_id', t.parent_id,
      'subject_id', t.subject_id,
      'student_ids', (
        SELECT json_agg(tlts.student_id)
        FROM public.tutor_logs_topics_students tlts
        WHERE tlts.tutor_logs_topics_id = tlt.id
      )
    ))
    FROM public.tutor_logs_topics tlt
    JOIN public.topics t ON t.id = tlt.topic_id
    WHERE tlt.tutor_log_id = tl.id
  ) AS topics,
  (
    SELECT json_agg(json_build_object(
      'id', tltf.id,
      'topics_files_id', tf.id,
      'topic_id', tf.topic_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'type', tf.type,
      'is_solutions', tf.is_solutions,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'student_ids', (
        SELECT json_agg(tltfs.student_id)
        FROM public.tutor_logs_topics_files_students tltfs
        WHERE tltfs.tutor_logs_topics_files_id = tltf.id
      )
    ))
    FROM public.tutor_logs_topics_files tltf
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    JOIN public.files f ON f.id = tf.file_id
    WHERE tltf.tutor_log_id = tl.id
  ) AS files,
  (
    SELECT json_agg(
      json_build_object(
        'id', n.id,
        'note', n.note,
        'created_at', n.created_at,
        'created_by', n.created_by
      ) ORDER BY n.created_at ASC
    )
    FROM public.notes n
    WHERE n.target_type = 'sessions'
      AND n.target_id = tl.session_id
  ) AS notes,
  tl.logged_for_staff_id,
  tl.updated_by,
  submitter.first_name AS created_by_first_name,
  submitter.last_name AS created_by_last_name,
  logged_for.first_name AS logged_for_first_name,
  logged_for.last_name AS logged_for_last_name,
  editor.first_name AS updated_by_first_name,
  editor.last_name AS updated_by_last_name
FROM public.tutor_logs tl
LEFT JOIN public.staff submitter ON submitter.id = tl.created_by
LEFT JOIN public.staff logged_for ON logged_for.id = tl.logged_for_staff_id
LEFT JOIN public.staff editor ON editor.id = tl.updated_by
WHERE
  tl.created_by = public.current_tutor_id()
  OR tl.logged_for_staff_id = public.current_tutor_id()
  OR tl.id IN (
    SELECT tutor_log_id
    FROM public.tutor_logs_staff_attendance
    WHERE staff_id = public.current_tutor_id()
  )
  OR tl.session_id IN (
    SELECT session_id
    FROM public.sessions_staff
    WHERE staff_id = public.current_tutor_id()
  );

GRANT SELECT ON public.vtutor_tutor_log TO authenticated;

CREATE OR REPLACE FUNCTION public.search_tutor_logs_admin(
  p_search TEXT DEFAULT NULL,
  p_range_start DATE DEFAULT NULL,
  p_range_end DATE DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'session_start_at',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
DECLARE
  result JSONB;
  search_term TEXT := NULLIF(LOWER(BTRIM(p_search)), '');
  fuzzy_search TEXT;
  range_start_utc TIMESTAMPTZ;
  range_end_utc TIMESTAMPTZ;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'tutorLogs', '[]'::JSONB,
      'sessions', '{}'::JSONB,
      'sessionStudents', '{}'::JSONB,
      'sessionStaff', '{}'::JSONB,
      'classesById', '{}'::JSONB,
      'subjectsById', '{}'::JSONB,
      'staffAttendance', '{}'::JSONB,
      'studentAttendance', '{}'::JSONB,
      'topics', '{}'::JSONB,
      'topicFiles', '{}'::JSONB,
      'total', 0
    );
  END IF;

  fuzzy_search := public.build_fuzzy_like(search_term);
  IF p_range_start IS NOT NULL THEN
    range_start_utc := p_range_start::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
  END IF;
  IF p_range_end IS NOT NULL THEN
    range_end_utc := (p_range_end + 1)::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
  END IF;

  WITH filtered_logs AS (
    SELECT
      tl.id,
      tl.session_id,
      tl.created_by,
      tl.logged_for_staff_id,
      tl.updated_by,
      tl.created_at,
      tl.updated_at,
      s.start_at
    FROM public.tutor_logs tl
    JOIN public.sessions s ON s.id = tl.session_id
    WHERE (search_term IS NULL OR EXISTS (
      SELECT 1
      FROM public.tutor_logs_topics tlt
      JOIN public.topics t ON t.id = tlt.topic_id
      WHERE tlt.tutor_log_id = tl.id
        AND (
          LOWER(t.name) LIKE '%' || search_term || '%'
          OR LOWER(COALESCE(t.code, '')) LIKE '%' || search_term || '%'
          OR (fuzzy_search IS NOT NULL AND (
            t.name ILIKE fuzzy_search OR COALESCE(t.code, '') ILIKE fuzzy_search
          ))
        )
    ) OR EXISTS (
      SELECT 1
      FROM public.tutor_logs_topics_files tltf
      JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
      WHERE tltf.tutor_log_id = tl.id
        AND (
          LOWER(COALESCE(tf.code, '')) LIKE '%' || search_term || '%'
          OR (fuzzy_search IS NOT NULL AND COALESCE(tf.code, '') ILIKE fuzzy_search)
        )
    ))
      AND (range_start_utc IS NULL OR s.start_at >= range_start_utc)
      AND (range_end_utc IS NULL OR s.start_at < range_end_utc)
      AND (
        p_staff_id IS NULL
        OR tl.created_by = p_staff_id
        OR tl.logged_for_staff_id = p_staff_id
        OR EXISTS (
          SELECT 1
          FROM public.tutor_logs_staff_attendance tlsa
          WHERE tlsa.tutor_log_id = tl.id
            AND tlsa.staff_id = p_staff_id
        )
      )
  ),
  paged_logs AS (
    SELECT *
    FROM filtered_logs
    ORDER BY
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      CASE WHEN p_order_by = 'session_start_at' AND p_ascending THEN start_at END ASC,
      CASE WHEN p_order_by = 'session_start_at' AND NOT p_ascending THEN start_at END DESC,
      id
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  ),
  selected_session_ids AS (
    SELECT DISTINCT session_id FROM paged_logs
  ),
  selected_log_ids AS (
    SELECT id FROM paged_logs
  ),
  selected_class_ids AS (
    SELECT DISTINCT s.class_id AS id
    FROM public.sessions s
    JOIN selected_session_ids selected ON selected.session_id = s.id
    WHERE s.class_id IS NOT NULL
  ),
  selected_subject_ids AS (
    SELECT DISTINCT subject_id AS id
    FROM (
      SELECT s.subject_id
      FROM public.sessions s
      JOIN selected_session_ids selected ON selected.session_id = s.id
      UNION
      SELECT c.subject_id
      FROM public.classes c
      JOIN selected_class_ids selected ON selected.id = c.id
    ) subjects
    WHERE subject_id IS NOT NULL
  ),
  session_students_grouped AS (
    SELECT
      ss.session_id,
      jsonb_agg(jsonb_build_object(
        'id', student.id,
        'first_name', student.first_name,
        'last_name', student.last_name,
        'status', student.status,
        'curriculum', student.curriculum,
        'year_level', student.year_level,
        'school', student.school,
        'planned_absence', COALESCE(ss.planned_absence, FALSE),
        'is_extra', CASE
          WHEN session.class_id IS NOT NULL AND class_student.id IS NULL THEN TRUE
          ELSE FALSE
        END
      ) ORDER BY student.first_name, student.last_name) AS rows
    FROM public.sessions_students ss
    JOIN selected_session_ids selected ON selected.session_id = ss.session_id
    JOIN public.students student ON student.id = ss.student_id
    JOIN public.sessions session ON session.id = ss.session_id
    LEFT JOIN public.classes_students class_student
      ON class_student.class_id = session.class_id
     AND class_student.student_id = ss.student_id
     AND (class_student.unenrolled_at IS NULL OR class_student.unenrolled_at > session.start_at)
    GROUP BY ss.session_id
  ),
  session_staff_grouped AS (
    SELECT
      ss.session_id,
      jsonb_agg(jsonb_build_object(
        'id', staff.id,
        'first_name', staff.first_name,
        'last_name', staff.last_name,
        'email', staff.email,
        'role', staff.role,
        'planned_absence', COALESCE(ss.planned_absence, FALSE)
      ) ORDER BY staff.first_name, staff.last_name) AS rows
    FROM public.sessions_staff ss
    JOIN selected_session_ids selected ON selected.session_id = ss.session_id
    JOIN public.staff staff ON staff.id = ss.staff_id
    GROUP BY ss.session_id
  ),
  staff_attendance_grouped AS (
    SELECT
      attendance.tutor_log_id,
      jsonb_agg(jsonb_build_object(
        'staff_id', staff.id,
        'first_name', staff.first_name,
        'last_name', staff.last_name,
        'role', staff.role,
        'attended', attendance.attended,
        'type', attendance.type
      ) ORDER BY staff.first_name, staff.last_name) AS rows
    FROM public.tutor_logs_staff_attendance attendance
    JOIN selected_log_ids selected ON selected.id = attendance.tutor_log_id
    JOIN public.staff staff ON staff.id = attendance.staff_id
    GROUP BY attendance.tutor_log_id
  ),
  student_attendance_grouped AS (
    SELECT
      attendance.tutor_log_id,
      jsonb_agg(jsonb_build_object(
        'student_id', student.id,
        'first_name', student.first_name,
        'last_name', student.last_name,
        'attended', attendance.attended
      ) ORDER BY student.first_name, student.last_name) AS rows
    FROM public.tutor_logs_student_attendance attendance
    JOIN selected_log_ids selected ON selected.id = attendance.tutor_log_id
    JOIN public.students student ON student.id = attendance.student_id
    GROUP BY attendance.tutor_log_id
  ),
  topics_grouped AS (
    SELECT
      tlt.tutor_log_id,
      jsonb_agg(jsonb_build_object(
        'topic_id', topic.id,
        'code', topic.code,
        'name', topic.name
      ) ORDER BY topic.code, topic.name) AS rows
    FROM public.tutor_logs_topics tlt
    JOIN selected_log_ids selected ON selected.id = tlt.tutor_log_id
    JOIN public.topics topic ON topic.id = tlt.topic_id
    GROUP BY tlt.tutor_log_id
  ),
  topic_files_grouped AS (
    SELECT
      tltf.tutor_log_id,
      jsonb_agg(jsonb_build_object(
        'file_id', file.file_id,
        'code', file.code,
        'file_type', file.type
      ) ORDER BY file.code) AS rows
    FROM public.tutor_logs_topics_files tltf
    JOIN selected_log_ids selected ON selected.id = tltf.tutor_log_id
    JOIN public.topics_files file ON file.id = tltf.topics_files_id
    GROUP BY tltf.tutor_log_id
  )
  SELECT jsonb_build_object(
    'tutorLogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'session_id', session_id,
        'created_by', created_by,
        'logged_for_staff_id', logged_for_staff_id,
        'updated_by', updated_by,
        'created_at', created_at,
        'updated_at', updated_at
      ) ORDER BY
        CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
        CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
        CASE WHEN p_order_by = 'session_start_at' AND p_ascending THEN start_at END ASC,
        CASE WHEN p_order_by = 'session_start_at' AND NOT p_ascending THEN start_at END DESC,
        id)
      FROM paged_logs
    ), '[]'::JSONB),
    'sessions', COALESCE((
      SELECT jsonb_object_agg(session.id::TEXT, to_jsonb(session))
      FROM public.sessions session
      JOIN selected_session_ids selected ON selected.session_id = session.id
    ), '{}'::JSONB),
    'sessionStudents', COALESCE((
      SELECT jsonb_object_agg(session_id::TEXT, rows) FROM session_students_grouped
    ), '{}'::JSONB),
    'sessionStaff', COALESCE((
      SELECT jsonb_object_agg(session_id::TEXT, rows) FROM session_staff_grouped
    ), '{}'::JSONB),
    'classesById', COALESCE((
      SELECT jsonb_object_agg(class.id::TEXT, to_jsonb(class))
      FROM public.classes class
      JOIN selected_class_ids selected ON selected.id = class.id
    ), '{}'::JSONB),
    'subjectsById', COALESCE((
      SELECT jsonb_object_agg(subject.id::TEXT, to_jsonb(subject))
      FROM public.subjects subject
      JOIN selected_subject_ids selected ON selected.id = subject.id
    ), '{}'::JSONB),
    'staffAttendance', COALESCE((
      SELECT jsonb_object_agg(tutor_log_id::TEXT, rows) FROM staff_attendance_grouped
    ), '{}'::JSONB),
    'studentAttendance', COALESCE((
      SELECT jsonb_object_agg(tutor_log_id::TEXT, rows) FROM student_attendance_grouped
    ), '{}'::JSONB),
    'topics', COALESCE((
      SELECT jsonb_object_agg(tutor_log_id::TEXT, rows) FROM topics_grouped
    ), '{}'::JSONB),
    'topicFiles', COALESCE((
      SELECT jsonb_object_agg(tutor_log_id::TEXT, rows) FROM topic_files_grouped
    ), '{}'::JSONB),
    'total', (SELECT COUNT(*) FROM filtered_logs)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_tutor_logs_admin(
  TEXT, DATE, DATE, UUID, INTEGER, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_tutor_logs_admin(
  TEXT, DATE, DATE, UUID, INTEGER, INTEGER, TEXT, BOOLEAN
) TO authenticated, service_role, postgres;

COMMENT ON FUNCTION public.search_tutor_logs_admin(
  TEXT, DATE, DATE, UUID, INTEGER, INTEGER, TEXT, BOOLEAN
) IS
  'Admin tutor-log search. Staff filtering matches immutable submitter, operational attribution, or attendance.';
