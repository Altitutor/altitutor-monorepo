-- Exchange owns mailbox contents; Altitutor owns responsibility and context.
-- Keep the onboarding history projection during the unified-mailbox cutover.
CREATE TABLE public.email_threads (
  id text PRIMARY KEY,
  assigned_staff_id uuid REFERENCES public.staff(id),
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((assigned_staff_id IS NULL) = (assigned_at IS NULL))
);
CREATE INDEX email_threads_assignee ON public.email_threads(assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;
CREATE TABLE public.email_folders (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text,
  parent_id text,
  present boolean NOT NULL DEFAULT true
);
CREATE TABLE public.email_sync_state (
  folder_id text PRIMARY KEY,
  cursor_url text,
  page_at timestamptz,
  completed_at timestamptz,
  bootstrap_started_at timestamptz,
  last_error text
);
CREATE TABLE public.email_messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES public.email_threads(id),
  folder_id text,
  data jsonb NOT NULL CHECK(jsonb_typeof(data) = 'object'),
  occurred_at timestamptz,
  seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  removed boolean NOT NULL DEFAULT false
);
CREATE INDEX email_messages_thread ON public.email_messages(thread_id,occurred_at,id);
CREATE INDEX email_messages_folder ON public.email_messages(folder_id,occurred_at DESC,id) WHERE NOT removed;

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_threads,public.email_folders,public.email_messages,public.email_sync_state FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_threads,public.email_folders,public.email_messages TO authenticated;
GRANT ALL ON public.email_threads,public.email_folders,public.email_messages,public.email_sync_state TO service_role;
CREATE POLICY "Active admins read email threads" ON public.email_threads FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active admins read email folders" ON public.email_folders FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active admins read email messages" ON public.email_messages FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE TABLE public.email_record_links (
 thread_id text NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
 record_type text NOT NULL CHECK(record_type IN ('student','parent','staff','session','invoice','onboarding_journey')),
 record_id uuid NOT NULL,
 source text NOT NULL CHECK(source IN ('direct','explicit')),
 PRIMARY KEY(thread_id,record_type,record_id)
);
CREATE INDEX email_record_links_record ON public.email_record_links(record_type,record_id,thread_id);
ALTER TABLE public.email_record_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_record_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_record_links TO authenticated;
GRANT ALL ON public.email_record_links TO service_role;
CREATE POLICY "Active admins read email context" ON public.email_record_links FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE TABLE public.email_participant_links (
 email text PRIMARY KEY CHECK(email=lower(btrim(email))),
 record_type text NOT NULL CHECK(record_type IN ('student','parent','staff')),
 record_id uuid NOT NULL
);
CREATE INDEX email_participant_links_record ON public.email_participant_links(record_type,record_id);
ALTER TABLE public.email_participant_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_participant_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_participant_links TO authenticated;
GRANT ALL ON public.email_participant_links TO service_role;
CREATE POLICY "Active admins read reviewed email identities" ON public.email_participant_links FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION public.email_thread_detail(p_thread_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',t.id,'assignedStaffId',t.assigned_staff_id,'assignedAt',t.assigned_at,
   'links',coalesce((SELECT jsonb_agg(jsonb_build_object('recordType',l.record_type,'recordId',l.record_id,'source',l.source,'label',coalesce(
     CASE l.record_type WHEN 'student' THEN (SELECT concat_ws(' ',s.first_name,s.last_name) FROM public.students s WHERE s.id=l.record_id)
       WHEN 'parent' THEN (SELECT concat_ws(' ',p.first_name,p.last_name) FROM public.parents p WHERE p.id=l.record_id)
       WHEN 'staff' THEN (SELECT concat_ws(' ',s.first_name,s.last_name) FROM public.staff s WHERE s.id=l.record_id)
       WHEN 'onboarding_journey' THEN (SELECT j.label FROM public.onboarding_journeys j WHERE j.id=l.record_id) END,l.record_type)) ORDER BY l.record_type,l.record_id) FROM public.email_record_links l WHERE l.thread_id=t.id),'[]'::jsonb),
   'messages',coalesce((SELECT jsonb_agg(m.data || jsonb_build_object('id',m.id,'threadId',m.thread_id,'folderId',m.folder_id,'removed',m.removed) ORDER BY m.occurred_at,m.id)
     FROM public.email_messages m WHERE m.thread_id=t.id),'[]'::jsonb))
 FROM public.email_threads t WHERE t.id=p_thread_id;
$$;
REVOKE ALL ON FUNCTION public.email_thread_detail(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_thread_detail(text) TO authenticated,service_role;

CREATE FUNCTION public.email_apply_sync_page(p_folder_id text,p_expected_cursor text,p_cursor text,p_complete boolean,p_messages jsonb,p_removed_ids text[],p_observation_only boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
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
     WHERE value IS NOT NULL AND lower(value) <> 'admin@altitutor.com'
   ), profiles AS (
     SELECT 'student' AS kind,s.id,lower(s.email) AS email FROM public.students s JOIN addresses a ON a.email=lower(s.email)
     UNION ALL SELECT 'parent',p.id,lower(p.email) FROM public.parents p JOIN addresses a ON a.email=lower(p.email)
     UNION ALL SELECT 'staff',s.id,lower(s.email) FROM public.staff s JOIN addresses a ON a.email=lower(s.email)
   ), matches AS (
     SELECT p.kind,p.id,p.email FROM profiles p WHERE NOT EXISTS(SELECT 1 FROM public.email_participant_links l WHERE l.email=p.email)
     UNION ALL SELECT l.record_type,l.record_id,l.email FROM public.email_participant_links l JOIN addresses a ON a.email=l.email
   ), unique_matches AS (SELECT *,count(*) OVER (PARTITION BY email) AS matches FROM matches)
   INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
   SELECT v_thread,kind,id,'direct' FROM unique_matches WHERE matches=1 ON CONFLICT DO NOTHING;
   -- Preserve explicit links and registration evidence on the legacy reader
   -- during cutover. Ignore is a staff review decision, never provider state.
   IF NOT coalesce((v_data->>'draft')::boolean,false) AND nullif(v_data->>'sender','') IS NOT NULL
     AND coalesce(v_data->>'receivedAt',v_data->>'sentAt') IS NOT NULL
     AND (lower(v_data->>'sender') <> 'admin@altitutor.com' OR v_data->>'sentAt' IS NOT NULL) THEN
     INSERT INTO public.onboarding_emails(id,internet_message_id,conversation_id,subject,body_text,sender,recipients,occurred_at,direction,delivery_status)
     VALUES(v_input->>'id',v_data->>'internetMessageId',v_thread,coalesce(v_data->>'subject',''),coalesce(v_data->>'bodyText',''),lower(v_data->>'sender'),
       ARRAY(SELECT jsonb_array_elements_text(coalesce(v_data->'to','[]'::jsonb) || coalesce(v_data->'cc','[]'::jsonb))),
       CASE WHEN lower(v_data->>'sender')='admin@altitutor.com' THEN (v_data->>'sentAt')::timestamptz ELSE (v_data->>'receivedAt')::timestamptz END,
       CASE WHEN lower(v_data->>'sender')='admin@altitutor.com' THEN 'outbound' ELSE 'inbound' END,
       CASE WHEN lower(v_data->>'sender')='admin@altitutor.com' THEN 'sent' ELSE 'received' END)
     ON CONFLICT(id) DO UPDATE SET internet_message_id=excluded.internet_message_id,conversation_id=excluded.conversation_id,subject=excluded.subject,
       body_text=excluded.body_text,sender=excluded.sender,recipients=excluded.recipients,occurred_at=excluded.occurred_at,direction=excluded.direction,delivery_status=excluded.delivery_status;
   END IF;
   IF NOT coalesce((v_data->>'draft')::boolean,false) AND lower(v_data->>'sender')='admin@altitutor.com' AND v_data->>'sentAt' IS NOT NULL THEN
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
     IF lower(v_data->>'sender')='admin@altitutor.com'
       AND (v_data->>'sentAt')::timestamptz > v_assignment.assigned_at
       AND (v_old.id IS NULL OR coalesce((v_old.data->>'draft')::boolean,false) OR v_old.data->>'sentAt' IS DISTINCT FROM v_data->>'sentAt') THEN
       UPDATE public.email_threads SET assigned_staff_id=NULL,assigned_at=NULL WHERE id=v_thread;
     ELSIF lower(v_data->>'sender') <> 'admin@altitutor.com'
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
REVOKE ALL ON FUNCTION public.email_apply_sync_page(text,text,text,boolean,jsonb,text[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_apply_sync_page(text,text,text,boolean,jsonb,text[],boolean) TO service_role;

CREATE FUNCTION public.email_assign_thread(p_thread_id text,p_staff_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old uuid; v_subject text;
BEGIN
 IF coalesce((SELECT auth.role()),'') <> 'service_role' AND NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 IF p_staff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=p_staff_id AND role='ADMINSTAFF' AND status='ACTIVE') THEN
   RAISE EXCEPTION 'Email assignee must be an active adminstaff';
 END IF;
 SELECT assigned_staff_id INTO v_old FROM public.email_threads WHERE id=p_thread_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Email thread not found'; END IF;
 IF v_old IS NOT DISTINCT FROM p_staff_id THEN RETURN public.email_thread_detail(p_thread_id); END IF;
 UPDATE public.email_threads SET assigned_staff_id=p_staff_id,assigned_at=CASE WHEN p_staff_id IS NOT NULL THEN now() END WHERE id=p_thread_id;
 IF p_staff_id IS NOT NULL THEN
   SELECT data->>'subject' INTO v_subject FROM public.email_messages WHERE thread_id=p_thread_id ORDER BY occurred_at DESC NULLS LAST,id LIMIT 1;
   INSERT INTO public.notifications(staff_id,app_scope,notification_type,title,body,action_url,dedupe_key,priority,metadata)
   VALUES(p_staff_id,'staff_web','EMAIL_ASSIGNED','Assigned: ' || coalesce(nullif(v_subject,''),'Email conversation'),
     'This email conversation was assigned to you.','/email/' || replace(replace(replace(p_thread_id,'/','%2F'),'+','%2B'),'=','%3D'),
     'email:assigned:' || gen_random_uuid()::text,'important',jsonb_build_object('email_thread_id',p_thread_id));
 END IF;
 RETURN public.email_thread_detail(p_thread_id);
END;
$$;
REVOKE ALL ON FUNCTION public.email_assign_thread(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_assign_thread(text,uuid) TO authenticated,service_role;

-- Backfill existing evidence without touching ignored decisions or explicit
-- journey links. Folder/read state is unknown until the richer delta bootstrap.
INSERT INTO public.email_threads(id)
SELECT DISTINCT coalesce(nullif(conversation_id,''),'message:' || id) FROM public.onboarding_emails ON CONFLICT DO NOTHING;
INSERT INTO public.email_messages(id,thread_id,data,occurred_at)
SELECT id,coalesce(nullif(conversation_id,''),'message:' || id),
 jsonb_build_object('id',id,'threadId',coalesce(nullif(conversation_id,''),'message:' || id),'subject',subject,'bodyText',body_text,'sender',sender,
   'to',recipients,'draft',false,'internetMessageId',internet_message_id) ||
 CASE WHEN direction='outbound' THEN jsonb_build_object('sentAt',occurred_at) ELSE jsonb_build_object('receivedAt',occurred_at) END,
 occurred_at FROM public.onboarding_emails ON CONFLICT DO NOTHING;

-- Carry only actual historical journey decisions forward. The old reader's
-- inferred Parent/household matches are deliberately not converted into links.
INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
SELECT DISTINCT m.thread_id,'onboarding_journey',l.journey_id,'explicit'
FROM public.onboarding_email_links l JOIN public.email_messages m ON m.id=l.email_id ON CONFLICT DO NOTHING;
INSERT INTO public.email_record_links(thread_id,record_type,record_id,source)
SELECT DISTINCT m.thread_id,'student',j.student_id,'explicit'
FROM public.onboarding_email_links l JOIN public.email_messages m ON m.id=l.email_id
JOIN public.onboarding_journeys j ON j.id=l.journey_id WHERE j.student_id IS NOT NULL ON CONFLICT DO NOTHING;

CREATE FUNCTION public.email_link_record(p_thread_id text,p_record_type text,p_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_exists boolean;
BEGIN
 IF coalesce((SELECT auth.role()),'') <> 'service_role' AND NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 SELECT CASE p_record_type
   WHEN 'student' THEN EXISTS(SELECT 1 FROM public.students WHERE id=p_record_id)
   WHEN 'parent' THEN EXISTS(SELECT 1 FROM public.parents WHERE id=p_record_id)
   WHEN 'staff' THEN EXISTS(SELECT 1 FROM public.staff WHERE id=p_record_id)
   WHEN 'session' THEN EXISTS(SELECT 1 FROM public.sessions WHERE id=p_record_id)
   WHEN 'invoice' THEN EXISTS(SELECT 1 FROM public.invoices WHERE id=p_record_id)
   WHEN 'onboarding_journey' THEN EXISTS(SELECT 1 FROM public.onboarding_journeys WHERE id=p_record_id)
   ELSE false END INTO v_exists;
 IF NOT v_exists THEN RAISE EXCEPTION 'Email context record not found'; END IF;
 INSERT INTO public.email_record_links(thread_id,record_type,record_id,source) VALUES(p_thread_id,p_record_type,p_record_id,'explicit')
 ON CONFLICT(thread_id,record_type,record_id) DO UPDATE SET source='explicit';
 IF p_record_type='onboarding_journey' THEN
   INSERT INTO public.onboarding_email_links(email_id,journey_id)
   SELECT e.id,p_record_id FROM public.onboarding_emails e JOIN public.email_messages m ON m.id=e.id WHERE m.thread_id=p_thread_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN public.email_thread_detail(p_thread_id);
END;
$$;
REVOKE ALL ON FUNCTION public.email_link_record(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_link_record(text,text,uuid) TO authenticated,service_role;

CREATE TABLE public.email_send_attempts (
 message_id text NOT NULL REFERENCES public.email_messages(id),
 command_id uuid PRIMARY KEY,
 staff_id uuid NOT NULL REFERENCES public.staff(id),
 state text NOT NULL CHECK(state IN ('sending','submitted','uncertain','sent','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_send_attempts_active_message ON public.email_send_attempts(message_id) WHERE state<>'failed';
ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_send_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_send_attempts TO authenticated;
GRANT ALL ON public.email_send_attempts TO service_role;
CREATE POLICY "Active admins read send outcomes" ON public.email_send_attempts FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE FUNCTION public.email_begin_send(p_message_id text,p_change_key text,p_staff_id uuid,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_message public.email_messages; v_attempt public.email_send_attempts;
BEGIN
 SELECT * INTO v_message FROM public.email_messages WHERE id=p_message_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
 SELECT * INTO v_attempt FROM public.email_send_attempts WHERE command_id=p_command_id;
 IF FOUND THEN RETURN jsonb_build_object('proceed',false,'state',v_attempt.state); END IF;
 SELECT * INTO v_attempt FROM public.email_send_attempts WHERE message_id=p_message_id AND state<>'failed';
 IF FOUND THEN RETURN jsonb_build_object('proceed',false,'state',v_attempt.state); END IF;
 IF NOT coalesce((v_message.data->>'draft')::boolean,false) OR v_message.data->>'changeKey' IS DISTINCT FROM p_change_key THEN
   RETURN jsonb_build_object('proceed',false,'state','conflict');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff WHERE id=p_staff_id AND role='ADMINSTAFF' AND status='ACTIVE') THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.email_draft_edits WHERE message_id=p_message_id AND expires_at>now() AND (staff_id<>p_staff_id OR writing_until>now())) THEN
   RETURN jsonb_build_object('proceed',false,'state','busy');
 END IF;
 INSERT INTO public.email_send_attempts(message_id,command_id,staff_id,state) VALUES(p_message_id,p_command_id,p_staff_id,'sending');
 RETURN jsonb_build_object('proceed',true,'state','sending');
END;
$$;
REVOKE ALL ON FUNCTION public.email_begin_send(text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_begin_send(text,text,uuid,uuid) TO service_role;

CREATE TABLE public.email_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(nullif(btrim(name),'') IS NOT NULL),
 subject text NOT NULL DEFAULT '',
 body_text text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.email_signatures (
 staff_id uuid PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
 body_text text NOT NULL
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates,public.email_signatures FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_templates,public.email_signatures TO authenticated;
GRANT ALL ON public.email_templates,public.email_signatures TO service_role;
CREATE POLICY "Active admins manage email templates" ON public.email_templates FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active admins manage email signatures" ON public.email_signatures FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION public.email_list_threads(p_folder_id text,p_search text,p_assignee text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 50,p_sort text DEFAULT 'received',p_direction text DEFAULT 'desc')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH matching AS (
   SELECT m.* FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id
   WHERE NOT m.removed AND (p_folder_id='' OR m.folder_id=p_folder_id)
     AND (p_assignee='all' OR ('unassigned'=ANY(string_to_array(p_assignee,',')) AND t.assigned_staff_id IS NULL) OR t.assigned_staff_id::text=ANY(string_to_array(p_assignee,',')))
     AND (p_search='' OR position(lower(p_search) IN lower(coalesce(m.data->>'subject','') || ' ' || coalesce(m.data->>'bodyText','') || ' ' || coalesce(m.data->>'sender','') || ' ' || coalesce(m.data->>'to',''))) > 0)
 ), grouped AS (
   SELECT thread_id,max(occurred_at) AS occurred_at,array_agg(id ORDER BY occurred_at,id) AS ids,
     bool_and(coalesce((data->>'read')::boolean,false)) AS is_read,bool_or(coalesce((data->>'draft')::boolean,false)) AS is_draft,
     (array_agg(data ORDER BY occurred_at DESC NULLS LAST,id DESC))[1] AS latest
   FROM matching GROUP BY thread_id
 ), page AS (
   SELECT g.*,t.assigned_staff_id FROM grouped g JOIN public.email_threads t ON t.id=g.thread_id
   ORDER BY
     CASE WHEN p_sort='sender' AND p_direction='asc' THEN lower(g.latest->>'sender') END ASC,
     CASE WHEN p_sort='sender' AND p_direction<>'asc' THEN lower(g.latest->>'sender') END DESC,
     CASE WHEN p_sort<>'sender' AND p_direction='asc' THEN g.occurred_at END ASC NULLS LAST,
     CASE WHEN p_sort<>'sender' AND p_direction<>'asc' THEN g.occurred_at END DESC NULLS LAST,g.thread_id LIMIT least(greatest(p_limit,1),100)+1 OFFSET greatest(p_offset,0)
 ), visible AS (SELECT * FROM page LIMIT least(greatest(p_limit,1),100))
 SELECT jsonb_build_object('threads',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',thread_id,'messageIds',ids,'subject',coalesce(latest->>'subject',''),'preview',left(coalesce(latest->>'bodyText',''),240),
   'sender',coalesce(latest->>'sender',''),'senderName',latest->>'senderName','at',occurred_at,'read',is_read,'draft',is_draft,'assignedStaffId',assigned_staff_id)
   ORDER BY
   CASE WHEN p_sort='sender' AND p_direction='asc' THEN lower(latest->>'sender') END ASC,
   CASE WHEN p_sort='sender' AND p_direction<>'asc' THEN lower(latest->>'sender') END DESC,
   CASE WHEN p_sort<>'sender' AND p_direction='asc' THEN occurred_at END ASC NULLS LAST,
   CASE WHEN p_sort<>'sender' AND p_direction<>'asc' THEN occurred_at END DESC NULLS LAST,thread_id) FROM visible),'[]'::jsonb),
   'hasMore',(SELECT count(*) FROM page)>least(greatest(p_limit,1),100));
$$;
REVOKE ALL ON FUNCTION public.email_list_threads(text,text,text,integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_list_threads(text,text,text,integer,integer,text,text) TO authenticated,service_role;

-- Journey context comes from an explicitly selected contact/address/student or
-- an explicit correspondence link. A Parent's children are not email participants.
CREATE OR REPLACE FUNCTION public.onboarding_emails_for_journey(p_journey_id uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 100)
RETURNS SETOF public.onboarding_emails LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH journey AS (SELECT * FROM public.onboarding_journeys WHERE id=p_journey_id), addresses AS (
   SELECT lower(enquiry_email) AS email FROM journey WHERE enquiry_email IS NOT NULL
   UNION SELECT lower(c.email) FROM journey j JOIN public.contacts c ON c.id=j.contact_id WHERE c.email IS NOT NULL
   UNION SELECT lower(s.email) FROM journey j JOIN public.students s ON s.id=j.student_id WHERE s.email IS NOT NULL
 )
 SELECT e.* FROM public.onboarding_emails e WHERE EXISTS(SELECT 1 FROM journey) AND (
   EXISTS(SELECT 1 FROM public.onboarding_email_links l WHERE l.email_id=e.id AND l.journey_id=p_journey_id)
   OR EXISTS(SELECT 1 FROM addresses a WHERE a.email=e.sender OR a.email=ANY(e.recipients))
   OR EXISTS(SELECT 1 FROM public.email_messages m JOIN public.email_record_links l ON l.thread_id=m.thread_id
      WHERE m.id=e.id AND ((l.record_type='onboarding_journey' AND l.record_id=p_journey_id)
        OR (l.record_type='student' AND l.record_id=(SELECT student_id FROM journey))))
 ) ORDER BY e.occurred_at DESC,e.id DESC LIMIT least(greatest(p_limit,1),1000) OFFSET greatest(p_offset,0);
$$;

CREATE TABLE public.email_draft_edits (
 message_id text PRIMARY KEY REFERENCES public.email_messages(id),
 staff_id uuid NOT NULL REFERENCES public.staff(id),
 token uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 writing_until timestamptz
);
CREATE INDEX email_draft_edits_staff ON public.email_draft_edits(staff_id);
ALTER TABLE public.email_draft_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_draft_edits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_draft_edits TO service_role;
CREATE FUNCTION public.email_claim_draft(p_message_id text,p_change_key text,p_staff_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_message public.email_messages; v_edit public.email_draft_edits;
BEGIN
 SELECT * INTO v_message FROM public.email_messages WHERE id=p_message_id FOR UPDATE;
 IF NOT FOUND OR NOT coalesce((v_message.data->>'draft')::boolean,false) OR v_message.data->>'changeKey' IS DISTINCT FROM p_change_key THEN
   RETURN jsonb_build_object('state','conflict');
 END IF;
 IF EXISTS(SELECT 1 FROM public.email_send_attempts WHERE message_id=p_message_id AND state<>'failed') THEN RETURN jsonb_build_object('state','submitted'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff WHERE id=p_staff_id AND role='ADMINSTAFF' AND status='ACTIVE') THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_edit FROM public.email_draft_edits WHERE message_id=p_message_id;
 IF FOUND AND v_edit.expires_at>now() AND (v_edit.staff_id<>p_staff_id OR v_edit.token<>p_token OR v_edit.writing_until>now()) THEN
   RETURN jsonb_build_object('state','busy','staffId',v_edit.staff_id);
 END IF;
 INSERT INTO public.email_draft_edits(message_id,staff_id,token,expires_at,writing_until)
 VALUES(p_message_id,p_staff_id,p_token,now()+interval '60 seconds',now()+interval '30 seconds')
 ON CONFLICT(message_id) DO UPDATE SET staff_id=excluded.staff_id,token=excluded.token,expires_at=excluded.expires_at,writing_until=excluded.writing_until;
 RETURN jsonb_build_object('state','ready');
END;
$$;
REVOKE ALL ON FUNCTION public.email_claim_draft(text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_claim_draft(text,text,uuid,uuid) TO service_role;

CREATE FUNCTION public.email_link_participant(p_thread_id text,p_email text,p_record_type text,p_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce((SELECT auth.role()),'') <> 'service_role' AND NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 IF p_record_type NOT IN ('student','parent','staff') OR p_email IS NULL OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email participant'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_messages m WHERE m.thread_id=p_thread_id AND
   (lower(m.data->>'sender')=lower(btrim(p_email)) OR lower(btrim(p_email)) IN
     (SELECT lower(value) FROM jsonb_array_elements_text(coalesce(m.data->'to','[]'::jsonb) || coalesce(m.data->'cc','[]'::jsonb) || coalesce(m.data->'bcc','[]'::jsonb))))) THEN
   RAISE EXCEPTION 'Address must be a participant in this email thread';
 END IF;
 -- This validates both the active-admin actor and the actual target record.
 PERFORM public.email_link_record(p_thread_id,p_record_type,p_record_id);
 INSERT INTO public.email_participant_links(email,record_type,record_id) VALUES(lower(btrim(p_email)),p_record_type,p_record_id)
 ON CONFLICT(email) DO UPDATE SET record_type=excluded.record_type,record_id=excluded.record_id;
 RETURN public.email_thread_detail(p_thread_id);
END;
$$;
REVOKE ALL ON FUNCTION public.email_link_participant(text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_link_participant(text,text,text,uuid) TO authenticated,service_role;

CREATE FUNCTION public.email_reset_sync_cursor(p_folder_id text,p_expected_cursor text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.email_sync_state SET cursor_url=NULL,bootstrap_started_at=NULL,last_error='Microsoft requested a fresh folder sync.'
 WHERE folder_id=p_folder_id AND cursor_url IS NOT DISTINCT FROM nullif(p_expected_cursor,'');
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.email_reset_sync_cursor(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_reset_sync_cursor(text,text) TO service_role;

CREATE FUNCTION public.email_correspondence_for_record(p_record_type text,p_record_id uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 50)
RETURNS SETOF public.email_messages LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT m.* FROM public.email_messages m JOIN public.email_record_links l ON l.thread_id=m.thread_id
 WHERE l.record_type=p_record_type AND l.record_id=p_record_id AND NOT coalesce((m.data->>'draft')::boolean,false)
 ORDER BY m.occurred_at DESC NULLS LAST,m.id LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0);
$$;
REVOKE ALL ON FUNCTION public.email_correspondence_for_record(text,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_correspondence_for_record(text,uuid,integer,integer) TO authenticated,service_role;

CREATE FUNCTION public.email_create_enquiry(p_email_id text,p_values jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email public.onboarding_emails; v_existing public.onboarding_journeys; v_id uuid; v_thread text;
BEGIN
 IF coalesce((SELECT auth.role()),'') <> 'service_role' AND NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
   RAISE EXCEPTION 'Active adminstaff required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_email FROM public.onboarding_emails WHERE id=p_email_id FOR UPDATE;
 IF NOT FOUND OR v_email.direction<>'inbound' THEN RAISE EXCEPTION 'Received email required'; END IF;
 SELECT j.* INTO v_existing FROM public.onboarding_journeys j JOIN public.onboarding_email_links l ON l.journey_id=j.id WHERE l.email_id=p_email_id ORDER BY j.created_at,j.id LIMIT 1;
 IF FOUND THEN
   IF v_existing.student_id IS NOT DISTINCT FROM (p_values->>'student_id')::uuid AND v_existing.label=p_values->>'label' THEN RETURN v_existing.id; END IF;
   RAISE EXCEPTION 'This email is already linked to a journey';
 END IF;
 INSERT INTO public.onboarding_journeys(student_id,contact_id,label,enquiry_email,enquiry_at,historical,is_returning)
 VALUES((p_values->>'student_id')::uuid,(p_values->>'contact_id')::uuid,p_values->>'label',nullif(p_values->>'enquiry_email',''),
   (p_values->>'enquiry_at')::timestamptz,coalesce((p_values->>'historical')::boolean,false),coalesce((p_values->>'is_returning')::boolean,false)) RETURNING id INTO v_id;
 INSERT INTO public.onboarding_email_links(email_id,journey_id) VALUES(p_email_id,v_id);
 SELECT thread_id INTO v_thread FROM public.email_messages WHERE id=p_email_id;
 IF v_thread IS NOT NULL THEN
   INSERT INTO public.email_record_links(thread_id,record_type,record_id,source) VALUES(v_thread,'onboarding_journey',v_id,'explicit') ON CONFLICT DO NOTHING;
   IF p_values->>'student_id' IS NOT NULL THEN
     INSERT INTO public.email_record_links(thread_id,record_type,record_id,source) VALUES(v_thread,'student',(p_values->>'student_id')::uuid,'explicit') ON CONFLICT DO NOTHING;
   END IF;
 END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.email_create_enquiry(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_create_enquiry(text,jsonb) TO authenticated,service_role;

CREATE TABLE public.email_operational_sends (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 context_links jsonb NOT NULL CHECK(jsonb_typeof(context_links)='array'),
 actor_staff_id uuid REFERENCES public.staff(id),
 state text NOT NULL CHECK(state IN ('creating','ready','sending','submitted','uncertain_create','uncertain_send','sent','failed')),
 token uuid NOT NULL DEFAULT gen_random_uuid(),
 draft_id text,
 change_key text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX email_operational_sends_draft ON public.email_operational_sends(draft_id) WHERE draft_id IS NOT NULL;
CREATE INDEX email_operational_sends_unresolved ON public.email_operational_sends(updated_at) WHERE state IN ('creating','sending','submitted','uncertain_create','uncertain_send');
CREATE INDEX email_operational_sends_actor ON public.email_operational_sends(actor_staff_id) WHERE actor_staff_id IS NOT NULL;
ALTER TABLE public.email_operational_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_operational_sends FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_operational_sends TO service_role;
CREATE FUNCTION public.email_operational_prepare(p_key text,p_payload jsonb,p_links jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_send public.email_operational_sends; v_proceed boolean := false; v_link jsonb; v_exists boolean;
BEGIN
 IF nullif(btrim(p_key),'') IS NULL OR jsonb_typeof(p_links) IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid operational email'; END IF;
 FOR v_link IN SELECT value FROM jsonb_array_elements(p_links) LOOP
   SELECT CASE v_link->>'type'
     WHEN 'student' THEN EXISTS(SELECT 1 FROM public.students WHERE id=(v_link->>'id')::uuid)
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
CREATE FUNCTION public.email_operational_update(p_id uuid,p_token uuid,p_expected text,p_state text,p_draft_id text DEFAULT NULL,p_change_key text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT ((p_expected='creating' AND p_state IN ('ready','failed','uncertain_create')) OR (p_expected='ready' AND p_state IN ('sending','failed'))
   OR (p_expected='sending' AND p_state IN ('submitted','uncertain_send','failed'))) THEN RAISE EXCEPTION 'Invalid operational email transition'; END IF;
 UPDATE public.email_operational_sends SET state=p_state,draft_id=coalesce(p_draft_id,draft_id),change_key=coalesce(p_change_key,change_key),updated_at=clock_timestamp()
 WHERE id=p_id AND token=p_token AND state=p_expected AND (p_draft_id IS NULL OR draft_id IS NULL OR draft_id=p_draft_id);
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.email_operational_prepare(text,jsonb,jsonb,uuid),public.email_operational_update(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_operational_prepare(text,jsonb,jsonb,uuid),public.email_operational_update(uuid,uuid,text,text,text,text) TO service_role;

-- A bounded provider pass is shared by cron and every foreground staff client.
CREATE TABLE public.email_sync_lease (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 token uuid NOT NULL,
 expires_at timestamptz NOT NULL
);
ALTER TABLE public.email_sync_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_sync_lease FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_sync_lease TO service_role;
CREATE FUNCTION public.email_claim_sync(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_token IS NULL THEN RAISE EXCEPTION 'Sync ownership token required'; END IF;
 INSERT INTO public.email_sync_lease(singleton,token,expires_at) VALUES(true,p_token,clock_timestamp()+interval '90 seconds')
 ON CONFLICT(singleton) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at
 WHERE public.email_sync_lease.expires_at<clock_timestamp();
 RETURN FOUND;
END;
$$;
CREATE FUNCTION public.email_release_sync(p_token uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 DELETE FROM public.email_sync_lease WHERE singleton AND token=p_token;
$$;
REVOKE ALL ON FUNCTION public.email_claim_sync(uuid),public.email_release_sync(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_claim_sync(uuid),public.email_release_sync(uuid) TO service_role;
