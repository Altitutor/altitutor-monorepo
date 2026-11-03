-- Service-only staging makes repeated previews/uploads of the same immutable snapshot converge.
CREATE FUNCTION public.stage_teaching_document(p_owner_staff_id uuid, p_input jsonb)
RETURNS public.teaching_documents LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE a public.teaching_documents; v_id uuid := gen_random_uuid(); v_bucket text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_owner_staff_id::text,p_input->>'sessionID',p_input->>'documentID',p_input->>'purpose',p_input->>'sha256'),0));
  SELECT * INTO a FROM public.teaching_documents
  WHERE owner_staff_id=p_owner_staff_id AND session_id=(p_input->>'sessionID')::uuid
    AND document_id=(p_input->>'documentID')::uuid AND purpose=p_input->>'purpose'
    AND sha256=p_input->>'sha256' AND filename=p_input->>'filename'
    AND canonical_topics_file_id IS NOT DISTINCT FROM (p_input->>'canonicalResourceID')::uuid
    AND state IN ('staged','ready') AND expires_at>now()+interval '5 minutes'
    AND deleted_at IS NULL AND cleanup_claimed_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN a; END IF;
  v_bucket := CASE p_input->>'purpose' WHEN 'print' THEN 'teaching-print' ELSE 'teaching-lessons' END;
  INSERT INTO public.teaching_documents(id,owner_staff_id,session_id,document_id,purpose,canonical_topics_file_id,
    filename,size_bytes,sha256,bucket,storage_path)
  VALUES(v_id,p_owner_staff_id,(p_input->>'sessionID')::uuid,(p_input->>'documentID')::uuid,p_input->>'purpose',
    (p_input->>'canonicalResourceID')::uuid,p_input->>'filename',(p_input->>'sizeBytes')::integer,p_input->>'sha256',
    v_bucket,p_owner_staff_id::text || '/' || v_id::text || '.pdf') RETURNING * INTO a;
  RETURN a;
END $$;
REVOKE ALL ON FUNCTION public.stage_teaching_document(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_teaching_document(uuid,jsonb) TO service_role;

CREATE FUNCTION public.prepare_teaching_print(p_artifact_id uuid,p_owner_staff_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.teaching_documents; v_file_id uuid;
BEGIN
  SELECT * INTO a FROM public.teaching_documents WHERE id=p_artifact_id AND owner_staff_id=p_owner_staff_id FOR UPDATE;
  IF NOT FOUND OR a.purpose<>'print' OR a.state<>'ready' OR a.verified_at IS NULL
     OR a.deleted_at IS NOT NULL OR a.cleanup_claimed_at IS NOT NULL OR a.expires_at<=now() THEN
    RAISE EXCEPTION 'Private print snapshot unavailable' USING ERRCODE='42501';
  END IF;
  IF a.file_id IS NOT NULL THEN RETURN a.file_id; END IF;
  INSERT INTO public.files(filename,mimetype,size_bytes,bucket,storage_path,storage_provider,created_by)
  VALUES(a.filename,'application/pdf',a.size_bytes,a.bucket,a.storage_path,'supabase',a.owner_staff_id)
  RETURNING id INTO v_file_id;
  UPDATE public.teaching_documents SET file_id=v_file_id WHERE id=a.id;
  RETURN v_file_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_teaching_print(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_teaching_print(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  p_file_id uuid,
  p_copies integer DEFAULT 1
)
RETURNS public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id uuid;
  v_is_admin boolean;
  v_file public.files;
  v_job public.print_jobs;
  v_copies integer;
  v_tutor_access public.tutor_office_print_access;
  v_snapshot public.teaching_documents;
BEGIN
  v_staff_id := public.current_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff profile required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_adminstaff_active();
  IF NOT v_is_admin AND NOT public.is_tutor() THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;

  v_copies := COALESCE(p_copies, 1);
  IF v_copies < 1 OR v_copies > 20 THEN
    RAISE EXCEPTION 'copies must be between 1 and 20';
  END IF;

  IF NOT public.is_print_connector_online() THEN
    RAISE EXCEPTION 'Office printer offline' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_admin THEN
    v_tutor_access := COALESCE(
      (SELECT s.tutor_access FROM public.office_print_settings s WHERE s.singleton),
      'office_hours'::public.tutor_office_print_access
    );
    IF v_tutor_access = 'off' THEN
      RAISE EXCEPTION 'Office print is turned off for tutors'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tutor_access IS DISTINCT FROM 'unrestricted'
       AND NOT public.is_office_print_window_open() THEN
      RAISE EXCEPTION 'Office print is only available during an admin shift'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Serialize duplicate checks, and share the artifact row lock with cleanup.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_file_id::text || v_staff_id::text,0));
  SELECT * INTO v_snapshot FROM public.teaching_documents WHERE file_id=p_file_id FOR UPDATE;
  IF FOUND AND (v_snapshot.purpose<>'print' OR v_snapshot.state<>'ready' OR v_snapshot.verified_at IS NULL
      OR v_snapshot.deleted_at IS NOT NULL OR v_snapshot.cleanup_claimed_at IS NOT NULL OR v_snapshot.expires_at<=now()) THEN
    RAISE EXCEPTION 'Private print snapshot unavailable' USING ERRCODE='42501';
  END IF;

  SELECT f.* INTO v_file
  FROM public.files f
  WHERE f.id = p_file_id
    AND f.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found' USING ERRCODE = 'P0002';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.external_url, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'External URL files cannot be office-printed';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.storage_path, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(v_file.bucket, '')), '') IS NULL THEN
    RAISE EXCEPTION 'File has no storage path';
  END IF;

  IF NOT (
    v_file.mimetype = 'application/pdf'
    OR lower(v_file.filename) LIKE '%.pdf'
  ) THEN
    RAISE EXCEPTION 'Only PDF files can be office-printed';
  END IF;

  IF v_is_admin THEN
    NULL; -- admins may print any storage PDF they can open in admin-web
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.vtutor_topics_files tf
      WHERE tf.file_id = p_file_id
    ) AND NOT (
      v_snapshot.id IS NOT NULL AND v_snapshot.owner_staff_id=v_staff_id
      AND EXISTS(SELECT 1 FROM public.vtutor_operational_session_detail s WHERE s.session_id=v_snapshot.session_id)
    ) THEN
      RAISE EXCEPTION 'File is not available to print' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.print_jobs j
    WHERE j.file_id = p_file_id
      AND j.requested_by_staff_id = v_staff_id
      AND (
        j.status IN ('queued', 'claimed')
        OR (
          j.status = 'succeeded'
          AND j.completed_at IS NOT NULL
          AND j.completed_at > now() - interval '60 seconds'
        )
      )
  ) THEN
    RAISE EXCEPTION 'A print job for this file is already in progress'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.print_jobs (
    file_id,
    bucket,
    storage_path,
    filename,
    copies,
    requested_by_staff_id
  ) VALUES (
    v_file.id,
    v_file.bucket,
    v_file.storage_path,
    v_file.filename,
    v_copies,
    v_staff_id
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

