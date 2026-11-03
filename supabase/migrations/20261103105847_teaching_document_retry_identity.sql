-- Keep the same immutable identity after publication and while an office job is pending.
CREATE OR REPLACE FUNCTION public.stage_teaching_document(p_owner_staff_id uuid, p_input jsonb)
RETURNS public.teaching_documents LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE a public.teaching_documents; v_id uuid := gen_random_uuid(); v_bucket text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_owner_staff_id::text,p_input->>'sessionID',p_input->>'documentID',p_input->>'purpose',p_input->>'sha256'),0));
  SELECT * INTO a FROM public.teaching_documents
  WHERE owner_staff_id=p_owner_staff_id AND session_id=(p_input->>'sessionID')::uuid
    AND document_id=(p_input->>'documentID')::uuid AND purpose=p_input->>'purpose'
    AND sha256=p_input->>'sha256' AND filename=p_input->>'filename'
    AND canonical_topics_file_id IS NOT DISTINCT FROM (p_input->>'canonicalResourceID')::uuid
    AND ((state IN ('staged','ready','published') AND expires_at>now()+interval '5 minutes')
      OR (purpose='print' AND state='ready' AND EXISTS(SELECT 1 FROM public.print_jobs j
        WHERE j.file_id=teaching_documents.file_id AND j.status IN ('queued','claimed'))))
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
