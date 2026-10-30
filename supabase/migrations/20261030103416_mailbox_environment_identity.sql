-- A database's provider IDs and cursors belong to exactly one mailbox.
CREATE TABLE public.email_mailbox_identity (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 address text NOT NULL CHECK(address IN ('admin@altitutor.com','admin@development.altitutor.com')),
 bound_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.email_mailbox_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_mailbox_identity FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.email_mailbox_identity TO service_role;
-- Earlier integrations could only operate admin@. Preserve and bind their state;
-- switching development to its new mailbox requires an explicitly reviewed reset.
INSERT INTO public.email_mailbox_identity(singleton,address)
SELECT true,'admin@altitutor.com' WHERE
 EXISTS(SELECT 1 FROM public.email_messages) OR EXISTS(SELECT 1 FROM public.email_threads)
 OR EXISTS(SELECT 1 FROM public.email_draft_edits) OR EXISTS(SELECT 1 FROM public.email_sync_lease) OR EXISTS(SELECT 1 FROM public.email_folders)
 OR EXISTS(SELECT 1 FROM public.email_sync_state) OR EXISTS(SELECT 1 FROM public.onboarding_emails)
 OR EXISTS(SELECT 1 FROM public.email_operational_sends) OR EXISTS(SELECT 1 FROM public.email_send_attempts);

CREATE FUNCTION public.email_assert_mailbox(p_address text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_address text;
BEGIN
 IF p_address IS NULL OR p_address NOT IN ('admin@altitutor.com','admin@development.altitutor.com') THEN
  RAISE EXCEPTION 'Unsupported mailbox identity';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(250,1);
 SELECT address INTO v_address FROM public.email_mailbox_identity WHERE singleton;
 IF v_address IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.email_messages) OR EXISTS(SELECT 1 FROM public.email_threads)
 OR EXISTS(SELECT 1 FROM public.email_draft_edits) OR EXISTS(SELECT 1 FROM public.email_sync_lease) OR EXISTS(SELECT 1 FROM public.email_folders)
   OR EXISTS(SELECT 1 FROM public.email_sync_state) OR EXISTS(SELECT 1 FROM public.onboarding_emails)
   OR EXISTS(SELECT 1 FROM public.email_operational_sends) OR EXISTS(SELECT 1 FROM public.email_send_attempts) THEN
   v_address := 'admin@altitutor.com';
  ELSE v_address := p_address;
  END IF;
  INSERT INTO public.email_mailbox_identity(singleton,address) VALUES(true,v_address);
 END IF;
 IF v_address <> p_address THEN
  RAISE EXCEPTION 'Mailbox identity differs from the database binding. Use the matching database; existing mail was preserved.';
 END IF;
 RETURN v_address;
END;
$$;
REVOKE ALL ON FUNCTION public.email_assert_mailbox(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_assert_mailbox(text) TO service_role;

-- Legacy callers retain production identity; they cannot write into development.
DROP FUNCTION public.email_apply_sync_page(text,text,text,boolean,jsonb,text[],boolean);
CREATE FUNCTION public.email_apply_sync_page(p_folder_id text,p_expected_cursor text,p_cursor text,p_complete boolean,p_messages jsonb,p_removed_ids text[],p_observation_only boolean DEFAULT false,p_mailbox_address text DEFAULT 'admin@altitutor.com')
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_mailbox text := public.email_assert_mailbox(p_mailbox_address);
 v_cursor text;
 v_input jsonb;
 v_old public.email_messages;
 v_data jsonb;
 v_thread text;
 v_assignment public.email_threads;
 v_page_at timestamptz := clock_timestamp();
 v_bootstrap timestamptz;
 v_operation record;
BEGIN
 -- One mailbox, one transactional page writer. A concurrent runner can safely
 -- fetch the same cursor; only the first matching page is committed.
 PERFORM pg_catalog.pg_advisory_xact_lock(250,1);
 IF NOT p_observation_only THEN
 INSERT INTO public.email_sync_state(folder_id) VALUES(p_folder_id) ON CONFLICT DO NOTHING;
 SELECT cursor_url,bootstrap_started_at INTO v_cursor,v_bootstrap FROM public.email_sync_state WHERE folder_id=p_folder_id FOR UPDATE;
 IF v_cursor IS DISTINCT FROM nullif(p_expected_cursor,'') THEN RETURN false; END IF;
 IF v_cursor IS NULL THEN v_bootstrap := v_page_at; END IF;
 END IF;
 IF jsonb_typeof(p_messages) <> 'array' OR (NOT p_observation_only AND nullif(p_cursor,'') IS NULL) THEN
   RAISE EXCEPTION 'Invalid mailbox sync page';
 END IF;
 FOR v_input IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
   IF nullif(v_input->>'id','') IS NULL THEN RAISE EXCEPTION 'Message identity required'; END IF;
   SELECT * INTO v_old FROM public.email_messages WHERE id=v_input->>'id';
   v_data := coalesce(v_old.data,'{}'::jsonb) || v_input;
   v_thread := coalesce(nullif(v_data->>'threadId',''),v_old.thread_id,'message:' || (v_input->>'id'));
   INSERT INTO public.email_threads(id) VALUES(v_thread) ON CONFLICT DO NOTHING;
   INSERT INTO public.email_messages(id,thread_id,folder_id,data,occurred_at,removed,seen_at)
   VALUES(v_input->>'id',v_thread,coalesce(v_data->>'folderId',p_folder_id),v_data,
     coalesce((v_data->>'sentAt')::timestamptz,(v_data->>'receivedAt')::timestamptz),false,v_page_at)
   ON CONFLICT(id) DO UPDATE SET thread_id=excluded.thread_id,folder_id=excluded.folder_id,data=excluded.data,occurred_at=excluded.occurred_at,removed=false,seen_at=excluded.seen_at;
   -- Resolve only unique direct addresses. Parent relationships never select
   -- a child; ambiguous identities need explicit review in the UI.
   WITH addresses AS (
     SELECT DISTINCT lower(value) AS email FROM jsonb_array_elements_text(
       jsonb_build_array(v_data->>'sender') || coalesce(v_data->'to','[]'::jsonb) || coalesce(v_data->'cc','[]'::jsonb) || coalesce(v_data->'bcc','[]'::jsonb))
     WHERE value IS NOT NULL AND lower(value) <> v_mailbox
   ), profiles AS (
     SELECT 'student' AS kind,s.id,lower(s.email) AS email FROM public.students s JOIN addresses a ON a.email=lower(s.email) WHERE s.deleted_at IS NULL
     UNION ALL SELECT 'parent',p.id,lower(p.email) FROM public.parents p JOIN addresses a ON a.email=lower(p.email)
     UNION ALL SELECT 'staff',s.id,lower(s.email) FROM public.staff s JOIN addresses a ON a.email=lower(s.email)
   ), valid_aliases AS (
     SELECT l.* FROM public.email_participant_links l WHERE
       (l.record_type='student' AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=l.record_id AND s.deleted_at IS NULL))
       OR (l.record_type='parent' AND EXISTS(SELECT 1 FROM public.parents p WHERE p.id=l.record_id))
       OR (l.record_type='staff' AND EXISTS(SELECT 1 FROM public.staff s WHERE s.id=l.record_id))
   ), matches AS (
     SELECT p.kind,p.id,p.email FROM profiles p WHERE NOT EXISTS(SELECT 1 FROM valid_aliases l WHERE l.email=p.email)
     UNION ALL SELECT l.record_type,l.record_id,l.email FROM valid_aliases l JOIN addresses a ON a.email=l.email
   ), unique_matches AS (SELECT *,count(*) OVER (PARTITION BY email) AS matches FROM matches)
   INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
   SELECT v_thread,kind,id,'direct' FROM unique_matches WHERE matches=1 ON CONFLICT DO NOTHING;
   -- Preserve explicit links and registration evidence on the legacy reader
   -- during cutover. Ignore is a staff review decision, never provider state.
   IF NOT coalesce((v_data->>'draft')::boolean,false) AND nullif(v_data->>'sender','') IS NOT NULL
     AND coalesce(v_data->>'receivedAt',v_data->>'sentAt') IS NOT NULL
     AND (lower(v_data->>'sender') <> v_mailbox OR v_data->>'sentAt' IS NOT NULL) THEN
     INSERT INTO public.onboarding_emails(id,internet_message_id,conversation_id,subject,body_text,sender,recipients,occurred_at,direction,delivery_status)
     VALUES(v_input->>'id',v_data->>'internetMessageId',v_thread,coalesce(v_data->>'subject',''),coalesce(v_data->>'bodyText',''),lower(v_data->>'sender'),
       ARRAY(SELECT jsonb_array_elements_text(coalesce(v_data->'to','[]'::jsonb) || coalesce(v_data->'cc','[]'::jsonb))),
       CASE WHEN lower(v_data->>'sender')=v_mailbox THEN (v_data->>'sentAt')::timestamptz ELSE (v_data->>'receivedAt')::timestamptz END,
       CASE WHEN lower(v_data->>'sender')=v_mailbox THEN 'outbound' ELSE 'inbound' END,
       CASE WHEN lower(v_data->>'sender')=v_mailbox THEN 'sent' ELSE 'received' END)
     ON CONFLICT(id) DO UPDATE SET internet_message_id=excluded.internet_message_id,conversation_id=excluded.conversation_id,subject=excluded.subject,
       body_text=excluded.body_text,sender=excluded.sender,recipients=excluded.recipients,occurred_at=excluded.occurred_at,direction=excluded.direction,delivery_status=excluded.delivery_status;
   END IF;
   IF NOT coalesce((v_data->>'draft')::boolean,false) AND lower(v_data->>'sender')=v_mailbox AND v_data->>'sentAt' IS NOT NULL THEN
     UPDATE public.email_send_attempts SET state='sent',updated_at=v_page_at WHERE message_id=v_input->>'id' AND state<>'failed';
     FOR v_operation IN SELECT * FROM public.email_operational_sends WHERE draft_id=v_input->>'id' FOR UPDATE LOOP
       UPDATE public.email_operational_sends SET state='sent',updated_at=v_page_at WHERE id=v_operation.id;
       INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
       SELECT v_thread,l->>'type',(l->>'id')::uuid,'explicit' FROM jsonb_array_elements(v_operation.context_links) l ON CONFLICT DO NOTHING;
       INSERT INTO public.onboarding_email_links(email_id,journey_id,purpose)
       SELECT v_input->>'id',(l->>'id')::uuid,l->>'purpose' FROM jsonb_array_elements(v_operation.context_links) l
       WHERE l->>'type'='onboarding_journey' ON CONFLICT(email_id,journey_id) DO UPDATE SET purpose=coalesce(excluded.purpose,public.onboarding_email_links.purpose);
     END LOOP;
   END IF;
   SELECT * INTO v_assignment FROM public.email_threads WHERE id=v_thread FOR UPDATE;
   IF v_assignment.assigned_staff_id IS NOT NULL AND NOT coalesce((v_data->>'draft')::boolean,false) THEN
     IF lower(v_data->>'sender')=v_mailbox
       AND (v_data->>'sentAt')::timestamptz > v_assignment.assigned_at
       AND (v_old.id IS NULL OR coalesce((v_old.data->>'draft')::boolean,false) OR v_old.data->>'sentAt' IS DISTINCT FROM v_data->>'sentAt') THEN
       UPDATE public.email_threads SET assigned_staff_id=NULL,assigned_at=NULL WHERE id=v_thread;
     ELSIF lower(v_data->>'sender') <> v_mailbox
       AND (v_data->>'receivedAt')::timestamptz > v_assignment.assigned_at
       AND v_old.id IS NULL THEN
       INSERT INTO public.notifications(staff_id,app_scope,notification_type,title,body,action_url,dedupe_key,priority,metadata)
       VALUES(v_assignment.assigned_staff_id,'staff_web','EMAIL_FOLLOWUP','New reply: ' || coalesce(nullif(v_data->>'subject',''),'Email conversation'),
         'A new message arrived in your assigned email conversation.','/email/' || replace(replace(replace(v_thread,'/','%2F'),'+','%2B'),'=','%3D'),
         'email:followup:' || (v_input->>'id') || ':' || v_assignment.assigned_staff_id::text,'important',jsonb_build_object('email_thread_id',v_thread))
       ON CONFLICT(dedupe_key) DO NOTHING;
     END IF;
   END IF;
 END LOOP;
 IF NOT p_observation_only THEN
 -- A source-folder tombstone must never erase a message already seen in its
 -- destination folder (immutable identity survives moves).
 UPDATE public.email_messages SET folder_id=NULL,removed=true WHERE id=ANY(p_removed_ids) AND folder_id=p_folder_id;
 IF p_complete AND v_bootstrap IS NOT NULL THEN
   UPDATE public.email_messages SET removed=true,folder_id=NULL WHERE folder_id=p_folder_id AND seen_at<v_bootstrap;
 END IF;
 UPDATE public.email_sync_state SET cursor_url=p_cursor,page_at=v_page_at,last_error=NULL,
   bootstrap_started_at=CASE WHEN p_complete THEN NULL ELSE v_bootstrap END,
   completed_at=CASE WHEN p_complete THEN now() ELSE completed_at END WHERE folder_id=p_folder_id;
 END IF;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.email_apply_sync_page(text,text,text,boolean,jsonb,text[],boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_apply_sync_page(text,text,text,boolean,jsonb,text[],boolean,text) TO service_role;

-- Legacy callers retain production identity; they cannot write into development.
DROP FUNCTION public.email_operational_prepare(text,jsonb,jsonb,uuid);
CREATE FUNCTION public.email_operational_prepare(p_key text,p_payload jsonb,p_links jsonb,p_actor uuid,p_mailbox_address text DEFAULT 'admin@altitutor.com')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_send public.email_operational_sends; v_proceed boolean := false; v_link jsonb; v_exists boolean;
BEGIN
 PERFORM public.email_assert_mailbox(p_mailbox_address);
 IF nullif(btrim(p_key),'') IS NULL OR jsonb_typeof(p_links) IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid operational email'; END IF;
 -- A retry carrying a pre-merge Student ID keeps the same delivery identity.
 SELECT coalesce(jsonb_agg(CASE WHEN l->>'type'='student' THEN jsonb_set(l,'{id}',to_jsonb(public.resolve_merged_student_id((l->>'id')::uuid)::text)) ELSE l END ORDER BY ordinal),'[]'::jsonb)
 INTO p_links FROM jsonb_array_elements(p_links) WITH ORDINALITY AS links(l,ordinal);
 FOR v_link IN SELECT value FROM jsonb_array_elements(p_links) LOOP
   SELECT CASE v_link->>'type'
     WHEN 'student' THEN EXISTS(SELECT 1 FROM public.students WHERE id=(v_link->>'id')::uuid AND deleted_at IS NULL)
     WHEN 'parent' THEN EXISTS(SELECT 1 FROM public.parents WHERE id=(v_link->>'id')::uuid)
     WHEN 'staff' THEN EXISTS(SELECT 1 FROM public.staff WHERE id=(v_link->>'id')::uuid)
     WHEN 'session' THEN EXISTS(SELECT 1 FROM public.sessions WHERE id=(v_link->>'id')::uuid)
     WHEN 'invoice' THEN EXISTS(SELECT 1 FROM public.invoices WHERE id=(v_link->>'id')::uuid)
     WHEN 'onboarding_journey' THEN EXISTS(SELECT 1 FROM public.onboarding_journeys WHERE id=(v_link->>'id')::uuid)
     ELSE false END INTO v_exists;
   IF NOT v_exists THEN RAISE EXCEPTION 'Operational email context record not found'; END IF;
   IF v_link ? 'purpose' AND v_link->>'purpose' NOT IN ('registration_link','ucat_link','followup') THEN RAISE EXCEPTION 'Invalid operational email purpose'; END IF;
 END LOOP;
 INSERT INTO public.email_operational_sends(idempotency_key,payload,context_links,actor_staff_id,state)
 VALUES(p_key,p_payload,p_links,p_actor,'creating') ON CONFLICT DO NOTHING RETURNING * INTO v_send;
 IF FOUND THEN v_proceed := true;
 ELSE
   SELECT * INTO v_send FROM public.email_operational_sends WHERE idempotency_key=p_key FOR UPDATE;
   IF v_send.payload IS DISTINCT FROM p_payload OR v_send.context_links IS DISTINCT FROM p_links THEN RAISE EXCEPTION 'Operational email idempotency key has different content'; END IF;
   IF v_send.state IN ('ready','failed') THEN
     UPDATE public.email_operational_sends SET token=gen_random_uuid(),state=CASE WHEN draft_id IS NULL THEN 'creating' ELSE 'ready' END,updated_at=clock_timestamp()
     WHERE id=v_send.id RETURNING * INTO v_send;
     v_proceed := true;
   END IF;
 END IF;
 RETURN jsonb_build_object('id',v_send.id,'state',v_send.state,'draftId',v_send.draft_id,'changeKey',v_send.change_key,'proceed',v_proceed,'token',CASE WHEN v_proceed THEN v_send.token END);
END;
$$;
REVOKE ALL ON FUNCTION public.email_operational_prepare(text,jsonb,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_operational_prepare(text,jsonb,jsonb,uuid,text) TO service_role;
