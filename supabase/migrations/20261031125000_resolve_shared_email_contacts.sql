-- Email and messaging share already-reviewed Contact address ownership.
-- INVOKER plus the active-admin guard preserves base-table/RLS boundaries.
CREATE FUNCTION public.email_people_for_address(p_email text)
RETURNS TABLE(record_type text,record_id uuid,label text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH profiles AS NOT MATERIALIZED (
   SELECT 'student'::text AS kind,s.id,s.email,s.first_name,s.last_name FROM public.students s WHERE s.deleted_at IS NULL
   UNION ALL SELECT 'parent',p.id,p.email,p.first_name,p.last_name FROM public.parents p
   UNION ALL SELECT 'staff',s.id,s.email,s.first_name,s.last_name FROM public.staff s
 ), reviewed AS (
   SELECT p.kind,p.id,p.first_name,p.last_name FROM public.email_participant_links l
   JOIN profiles p ON p.kind=l.record_type AND p.id=l.record_id WHERE l.email=lower(btrim(p_email))
 ), candidates AS (
   SELECT p.kind,p.id,p.first_name,p.last_name FROM profiles p WHERE lower(btrim(p.email))=lower(btrim(p_email))
   UNION
   SELECT p.kind,p.id,p.first_name,p.last_name FROM public.contacts c JOIN profiles p ON
     (p.kind='student' AND p.id=c.student_id) OR (p.kind='parent' AND p.id=c.parent_id) OR (p.kind='staff' AND p.id=c.staff_id)
   WHERE c.retired_at IS NULL AND lower(btrim(c.email))=lower(btrim(p_email))
 ), resolved AS (
   SELECT * FROM reviewed UNION ALL SELECT * FROM candidates WHERE NOT EXISTS(SELECT 1 FROM reviewed)
 )
 SELECT kind,id,coalesce(nullif(btrim(concat_ws(' ',first_name,last_name)),''),lower(btrim(p_email))) FROM resolved
 WHERE (SELECT auth.role())='service_role' OR (SELECT public.is_adminstaff_active());
$$;
REVOKE ALL ON FUNCTION public.email_people_for_address(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_people_for_address(text) TO authenticated,service_role;

-- Future observations use exactly the same identity resolution as chips.
-- Existing historical links remain immutable; no current-owner history backfill.
CREATE OR REPLACE FUNCTION public.email_apply_sync_page(p_folder_id text,p_expected_cursor text,p_cursor text,p_complete boolean,p_messages jsonb,p_removed_ids text[],p_observation_only boolean DEFAULT false,p_mailbox_address text DEFAULT 'admin@altitutor.com')
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
   -- A read/folder refresh must not reinterpret historical correspondence
   -- against an address that has since been reassigned to another person.
   IF v_old.id IS NULL OR
     jsonb_build_array(v_old.data->'sender',v_old.data->'to',v_old.data->'cc',v_old.data->'bcc') IS DISTINCT FROM
     jsonb_build_array(v_data->'sender',v_data->'to',v_data->'cc',v_data->'bcc') THEN
   WITH addresses AS (
     SELECT DISTINCT lower(btrim(value)) AS email FROM jsonb_array_elements_text(
       jsonb_build_array(v_data->>'sender') || coalesce(v_data->'to','[]'::jsonb) || coalesce(v_data->'cc','[]'::jsonb) || coalesce(v_data->'bcc','[]'::jsonb))
     WHERE value IS NOT NULL AND lower(btrim(value)) <> v_mailbox
   ), profiles AS (
     SELECT p.record_type AS kind,p.record_id AS id,a.email FROM addresses a
     CROSS JOIN LATERAL public.email_people_for_address(a.email) p
   ), unique_matches AS (SELECT *,count(*) OVER (PARTITION BY email) AS matches FROM profiles)
   INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
   SELECT v_thread,kind,id,'direct' FROM unique_matches WHERE matches=1 ON CONFLICT DO NOTHING;
   END IF;
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
