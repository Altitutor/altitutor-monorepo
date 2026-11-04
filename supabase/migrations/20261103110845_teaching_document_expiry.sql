-- Claim before external Storage deletion. Enqueue takes the same artifact lock and
-- refuses deleting snapshots, so a cleanup claim cannot race a newly queued job.
CREATE FUNCTION public.claim_teaching_document_expiry(p_limit integer DEFAULT 20)
RETURNS SETOF public.teaching_documents LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.teaching_documents;
BEGIN
  FOR a IN SELECT d.* FROM public.teaching_documents d
    WHERE d.deleted_at IS NULL AND d.cleanup_next_attempt_at<=now()
      AND (
        (d.purpose='lesson' AND d.expires_at<=now())
        OR (d.purpose='print' AND NOT EXISTS(SELECT 1 FROM public.print_jobs j WHERE j.file_id=d.file_id)
          AND d.expires_at<=now())
        OR (d.purpose='print' AND EXISTS(SELECT 1 FROM public.print_jobs j WHERE j.file_id=d.file_id)
          AND NOT EXISTS(SELECT 1 FROM public.print_jobs j WHERE j.file_id=d.file_id AND j.status IN ('queued','claimed'))
          AND (SELECT max(COALESCE(j.completed_at,j.updated_at)) FROM public.print_jobs j WHERE j.file_id=d.file_id)<=now()-interval '24 hours')
      )
    ORDER BY d.expires_at,d.id LIMIT LEAST(50,GREATEST(1,COALESCE(p_limit,20))) FOR UPDATE OF d SKIP LOCKED
  LOOP
    UPDATE public.teaching_documents SET state='deleting',cleanup_claimed_at=now(),cleanup_attempts=cleanup_attempts+1,
      cleanup_next_attempt_at=now()+interval '5 minutes' WHERE id=a.id RETURNING * INTO a;
    RETURN NEXT a;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.claim_teaching_document_expiry(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_teaching_document_expiry(integer) TO service_role;

CREATE FUNCTION public.finish_teaching_document_expiry(p_artifact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.teaching_documents;
BEGIN
  SELECT * INTO a FROM public.teaching_documents WHERE id=p_artifact_id AND state='deleting' AND cleanup_claimed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cleanup claim required' USING ERRCODE='22023'; END IF;
  UPDATE public.teaching_documents SET state='deleted',deleted_at=now() WHERE id=a.id;
  IF a.purpose='print' AND a.file_id IS NOT NULL THEN
    UPDATE public.files SET deleted_at=now() WHERE id=a.file_id AND deleted_at IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_teaching_document_expiry(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_teaching_document_expiry(uuid) TO service_role;

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
  IF FOUND THEN
    -- A newly issued upload token is valid for two hours. Extending staging on
    -- every re-sign keeps cleanup well beyond that token's entire lifetime.
    IF a.state='staged' THEN
      UPDATE public.teaching_documents SET expires_at=now()+interval '24 hours' WHERE id=a.id RETURNING * INTO a;
    END IF;
    RETURN a;
  END IF;
  v_bucket := CASE p_input->>'purpose' WHEN 'print' THEN 'teaching-print' ELSE 'teaching-lessons' END;
  INSERT INTO public.teaching_documents(id,owner_staff_id,session_id,document_id,purpose,canonical_topics_file_id,
    filename,size_bytes,sha256,bucket,storage_path)
  VALUES(v_id,p_owner_staff_id,(p_input->>'sessionID')::uuid,(p_input->>'documentID')::uuid,p_input->>'purpose',
    (p_input->>'canonicalResourceID')::uuid,p_input->>'filename',(p_input->>'sizeBytes')::integer,p_input->>'sha256',
    v_bucket,p_owner_staff_id::text || '/' || v_id::text || '.pdf') RETURNING * INTO a;
  RETURN a;
END $$;
