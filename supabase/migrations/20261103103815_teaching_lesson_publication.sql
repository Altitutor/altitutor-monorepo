CREATE TABLE public.teaching_document_students (
  document_id uuid NOT NULL REFERENCES public.teaching_documents(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  PRIMARY KEY(document_id,student_id)
);
ALTER TABLE public.teaching_document_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ADMINSTAFF read teaching recipients" ON public.teaching_document_students FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));
REVOKE ALL ON public.teaching_document_students FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.teaching_document_students TO authenticated;
GRANT ALL ON public.teaching_document_students TO service_role;
CREATE TABLE public.teaching_log_submissions (
  id uuid PRIMARY KEY,
  owner_staff_id uuid NOT NULL REFERENCES public.staff(id),
  session_id uuid NOT NULL REFERENCES public.sessions(id),
  tutor_log_id uuid NOT NULL REFERENCES public.tutor_logs(id),
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_log_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teaching_log_submissions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.teaching_log_submissions TO service_role;

-- Only the authenticated server boundary can call this; raise on any publication failure
-- so canonical log creation and all attachments roll back together.
CREATE FUNCTION public.create_teaching_tutor_log(p_submission_id uuid,p_input jsonb,p_annotations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_owner uuid := (p_input->>'p_created_by')::uuid;
  v_session uuid := (p_input->>'p_session_id')::uuid;
  v_hash text := encode(extensions.digest(p_input::text || p_annotations::text,'sha256'),'hex');
  v_previous public.teaching_log_submissions;
  v_result jsonb; v_log uuid; v_item jsonb; a public.teaching_documents; v_student uuid;
BEGIN
  IF jsonb_typeof(p_annotations)<>'array' OR jsonb_array_length(p_annotations)>50 THEN
    RAISE EXCEPTION 'Choose fewer lesson PDFs' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.sessions WHERE id=v_session AND deleted_at IS NULL AND status='ACTIVE' AND start_at<=now() FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.staff WHERE id=v_owner AND status='ACTIVE'
    AND role IN ('TUTOR','ADMINSTAFF') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'The lesson is not available for submission' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_previous FROM public.teaching_log_submissions WHERE id=p_submission_id;
  IF FOUND THEN
    IF v_previous.owner_staff_id<>v_owner OR v_previous.session_id<>v_session OR v_previous.payload_hash<>v_hash THEN
      RAISE EXCEPTION 'This submission was already saved with different details. Refresh to review the saved log.' USING ERRCODE='23505';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.tutor_logs WHERE id=v_previous.tutor_log_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'This tutor log is no longer active' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('success',true,'tutor_log_id',v_previous.tutor_log_id);
  END IF;
  IF EXISTS(SELECT 1 FROM public.tutor_logs WHERE session_id=v_session) THEN
    RAISE EXCEPTION 'A tutor log already exists for this session. Refresh to review it.' USING ERRCODE='23505';
  END IF;
  IF (SELECT count(DISTINCT value->>'artifactID') FROM jsonb_array_elements(p_annotations))<>jsonb_array_length(p_annotations) THEN
    RAISE EXCEPTION 'Choose each lesson PDF once' USING ERRCODE='22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_annotations) ORDER BY value->>'artifactID' LOOP
    SELECT * INTO a FROM public.teaching_documents WHERE id=(v_item->>'artifactID')::uuid FOR UPDATE;
    IF NOT FOUND OR a.owner_staff_id<>v_owner OR a.session_id<>v_session OR a.purpose<>'lesson'
       OR a.state<>'ready' OR a.verified_at IS NULL OR a.expires_at<=now() OR a.cleanup_claimed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A lesson PDF is not available. Reopen the log and retry.' USING ERRCODE='42501';
    END IF;
    IF a.canonical_topics_file_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_input->'p_topic_files') f
      JOIN public.topics_files tf ON tf.id=(f->>'topicsFilesId')::uuid
      JOIN public.files source ON source.id=tf.file_id AND source.deleted_at IS NULL
      WHERE tf.id=a.canonical_topics_file_id
        AND NOT tf.is_solutions AND tf.is_solutions_of_id IS NULL
    ) THEN
      RAISE EXCEPTION 'An annotated worksheet requires its canonical file' USING ERRCODE='22023';
    END IF;
    FOR v_student IN SELECT value::uuid FROM jsonb_array_elements_text(v_item->'studentIds') LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'p_student_attendance') s
        WHERE (s->>'studentId')::uuid=v_student AND (s->>'attended')::boolean) THEN
        RAISE EXCEPTION 'Share lesson PDFs only with attending students' USING ERRCODE='22023';
      END IF;
      IF a.canonical_topics_file_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(p_input->'p_topic_files') f,
          jsonb_array_elements_text(f->'studentIds') s
        WHERE (f->>'topicsFilesId')::uuid=a.canonical_topics_file_id AND s::uuid=v_student
      ) THEN
        RAISE EXCEPTION 'The student must also receive the canonical worksheet' USING ERRCODE='22023';
      END IF;
    END LOOP;
  END LOOP;
  v_result := public.create_tutor_log(v_session,v_owner,(p_input->>'p_logged_for_staff_id')::uuid,
    p_input->'p_staff_attendance',p_input->'p_student_attendance',p_input->'p_topics',
    p_input->'p_topic_files',p_input->'p_notes',p_input->'p_parent_attendance');
  IF NOT COALESCE((v_result->>'success')::boolean,false) THEN
    RAISE EXCEPTION '%',COALESCE(v_result->>'error','Could not create tutor log') USING ERRCODE='22023';
  END IF;
  v_log := (v_result->>'tutor_log_id')::uuid;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_annotations) LOOP
    UPDATE public.teaching_documents SET state='published',tutor_log_id=v_log,published_at=now(),expires_at=now()+interval '1 year'
      WHERE id=(v_item->>'artifactID')::uuid;
    INSERT INTO public.teaching_document_students(document_id,student_id)
      SELECT (v_item->>'artifactID')::uuid,value::uuid FROM jsonb_array_elements_text(v_item->'studentIds');
  END LOOP;
  INSERT INTO public.teaching_log_submissions(id,owner_staff_id,session_id,tutor_log_id,payload_hash)
    VALUES(p_submission_id,v_owner,v_session,v_log,v_hash);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.create_teaching_tutor_log(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_teaching_tutor_log(uuid,jsonb,jsonb) TO service_role;

-- Metadata remains as an expired stub; only currently authorized log viewers see it.
-- Canonical identity survives admin corrections, which replace detail-row IDs.
CREATE VIEW public.vtutor_lesson_documents WITH (security_invoker=false) AS
SELECT d.id,d.session_id,d.tutor_log_id,d.canonical_topics_file_id,d.filename,d.published_at,d.expires_at,
  (d.state='published' AND d.expires_at>now() AND d.deleted_at IS NULL) AS available
FROM public.teaching_documents d
JOIN public.tutor_logs log ON log.id=d.tutor_log_id AND log.deleted_at IS NULL
JOIN public.sessions session ON session.id=d.session_id AND session.deleted_at IS NULL
WHERE d.published_at IS NOT NULL AND (SELECT public.is_tutor())
  AND EXISTS(SELECT 1 FROM public.vtutor_tutor_log visible WHERE visible.tutor_log_id=d.tutor_log_id)
  AND (d.canonical_topics_file_id IS NULL OR EXISTS(SELECT 1 FROM public.tutor_logs_topics_files f
    WHERE f.tutor_log_id=d.tutor_log_id AND f.topics_files_id=d.canonical_topics_file_id));
CREATE VIEW public.vstudent_lesson_documents WITH (security_invoker=false) AS
SELECT d.id,d.session_id,d.tutor_log_id,d.canonical_topics_file_id,d.filename,d.published_at,d.expires_at,
  (d.state='published' AND d.expires_at>now() AND d.deleted_at IS NULL) AS available
FROM public.teaching_documents d
JOIN public.tutor_logs log ON log.id=d.tutor_log_id AND log.deleted_at IS NULL
JOIN public.sessions session ON session.id=d.session_id AND session.deleted_at IS NULL
JOIN public.teaching_document_students recipient ON recipient.document_id=d.id
  AND recipient.student_id=(SELECT public.current_student_id())
WHERE d.published_at IS NOT NULL AND (SELECT public.is_student())
  AND EXISTS(SELECT 1 FROM public.vstudent_tutor_log visible WHERE visible.tutor_log_id=d.tutor_log_id)
  AND (d.canonical_topics_file_id IS NULL OR EXISTS(SELECT 1 FROM public.tutor_logs_topics_files f
    JOIN public.tutor_logs_topics_files_students fs ON fs.tutor_logs_topics_files_id=f.id
    WHERE f.tutor_log_id=d.tutor_log_id AND f.topics_files_id=d.canonical_topics_file_id
      AND fs.student_id=(SELECT public.current_student_id())));
REVOKE ALL ON public.vtutor_lesson_documents,public.vstudent_lesson_documents FROM PUBLIC,anon;
GRANT SELECT ON public.vtutor_lesson_documents,public.vstudent_lesson_documents TO authenticated;
