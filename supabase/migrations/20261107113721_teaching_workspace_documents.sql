-- Private, tutor-scoped synchronization of immutable teaching originals.
-- Editable ink and page revisions stay in the local Teaching workspace.
ALTER TABLE public.teaching_documents
  DROP CONSTRAINT teaching_documents_purpose_check,
  DROP CONSTRAINT teaching_documents_check,
  ADD CONSTRAINT teaching_documents_purpose_check CHECK (purpose IN ('print', 'lesson', 'workspace')),
  ADD CONSTRAINT teaching_documents_bucket_check CHECK (
    (purpose = 'print' AND bucket = 'teaching-print')
    OR (purpose IN ('lesson', 'workspace') AND bucket = 'teaching-lessons')
  );

CREATE TABLE public.teaching_workspace_resources (
  owner_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL,
  item jsonb NOT NULL CHECK (jsonb_typeof(item) = 'object'),
  worksheet_artifact_id uuid NOT NULL REFERENCES public.teaching_documents(id) ON DELETE RESTRICT,
  solutions_artifact_id uuid REFERENCES public.teaching_documents(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_staff_id, session_id, item_id),
  CHECK (worksheet_artifact_id IS DISTINCT FROM solutions_artifact_id)
);

ALTER TABLE public.teaching_workspace_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teaching_workspace_resources FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.teaching_workspace_resources TO service_role;

CREATE VIEW public.vtutor_teaching_workspace_resources
WITH (security_barrier = true, security_invoker = false) AS
SELECT workspace.session_id, workspace.item_id, workspace.item, workspace.worksheet_artifact_id,
  workspace.solutions_artifact_id, workspace.created_at
FROM public.teaching_workspace_resources workspace
JOIN public.teaching_documents worksheet ON worksheet.id = workspace.worksheet_artifact_id
LEFT JOIN public.teaching_documents solutions ON solutions.id = workspace.solutions_artifact_id
WHERE workspace.owner_staff_id = (SELECT public.current_tutor_id())
  AND (SELECT public.is_tutor())
  AND EXISTS (
    SELECT 1 FROM public.vtutor_operational_session_detail session
    WHERE session.session_id = workspace.session_id
  )
  AND worksheet.state = 'published' AND worksheet.expires_at > now() AND worksheet.deleted_at IS NULL
  AND (solutions.id IS NULL OR (solutions.state = 'published' AND solutions.expires_at > now() AND solutions.deleted_at IS NULL));

REVOKE ALL ON public.vtutor_teaching_workspace_resources FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vtutor_teaching_workspace_resources TO authenticated;

CREATE FUNCTION public.register_teaching_workspace_resource(
  p_owner_staff_id uuid,
  p_session_id uuid,
  p_item_id uuid,
  p_item jsonb,
  p_worksheet uuid,
  p_solutions uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_document public.teaching_documents;
  v_expected integer := CASE WHEN p_solutions IS NULL THEN 1 ELSE 2 END;
  v_count integer := 0;
BEGIN
  -- Serialize the slot across tablets. A repeated registration reuses the first
  -- verified original. A replacement is possible after the original expires.
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|', p_owner_staff_id, p_session_id, p_item_id), 0));
  IF EXISTS (
    SELECT 1 FROM public.teaching_workspace_resources workspace
    JOIN public.teaching_documents worksheet ON worksheet.id = workspace.worksheet_artifact_id
    LEFT JOIN public.teaching_documents solutions ON solutions.id = workspace.solutions_artifact_id
    WHERE workspace.owner_staff_id = p_owner_staff_id AND workspace.session_id = p_session_id AND workspace.item_id = p_item_id
      AND worksheet.state = 'published' AND worksheet.expires_at > now() AND worksheet.deleted_at IS NULL
      AND (solutions.id IS NULL OR (solutions.state = 'published' AND solutions.expires_at > now() AND solutions.deleted_at IS NULL))
  ) THEN RETURN; END IF;

  FOR v_document IN
    SELECT * FROM public.teaching_documents
    WHERE id IN (p_worksheet, p_solutions) ORDER BY id FOR UPDATE
  LOOP
    IF v_document.owner_staff_id <> p_owner_staff_id OR v_document.session_id <> p_session_id
      OR v_document.purpose <> 'workspace' OR v_document.state <> 'ready'
      OR v_document.verified_at IS NULL OR v_document.expires_at <= now()
      OR v_document.deleted_at IS NOT NULL OR v_document.cleanup_claimed_at IS NOT NULL
      OR v_document.document_id IS DISTINCT FROM (
        p_item -> (CASE WHEN v_document.id = p_worksheet THEN 'worksheet' ELSE 'solutions' END) ->> 'id'
      )::uuid
    THEN RAISE EXCEPTION 'Teaching original unavailable' USING ERRCODE = '42501'; END IF;
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> v_expected OR p_worksheet IS NULL THEN
    RAISE EXCEPTION 'Teaching original unavailable' USING ERRCODE = '42501';
  END IF;

  UPDATE public.teaching_documents
  SET state = 'published', published_at = now(), expires_at = now() + interval '1 year'
  WHERE id IN (p_worksheet, p_solutions);

  INSERT INTO public.teaching_workspace_resources
    (owner_staff_id, session_id, item_id, item, worksheet_artifact_id, solutions_artifact_id)
  VALUES (p_owner_staff_id, p_session_id, p_item_id, p_item, p_worksheet, p_solutions)
  ON CONFLICT (owner_staff_id, session_id, item_id) DO UPDATE
    SET item = EXCLUDED.item, worksheet_artifact_id = EXCLUDED.worksheet_artifact_id,
        solutions_artifact_id = EXCLUDED.solutions_artifact_id;
END $$;

REVOKE ALL ON FUNCTION public.register_teaching_workspace_resource(uuid, uuid, uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_teaching_workspace_resource(uuid, uuid, uuid, jsonb, uuid, uuid)
  TO service_role;

-- Workspace uploads use the existing private lesson bucket and expiry worker.
CREATE OR REPLACE FUNCTION public.claim_teaching_document_expiry(p_limit integer DEFAULT 20)
RETURNS SETOF public.teaching_documents LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.teaching_documents;
BEGIN
  FOR a IN SELECT d.* FROM public.teaching_documents d
    WHERE d.deleted_at IS NULL AND d.cleanup_next_attempt_at<=now()
      AND (
        (d.purpose IN ('lesson', 'workspace') AND d.expires_at<=now())
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
