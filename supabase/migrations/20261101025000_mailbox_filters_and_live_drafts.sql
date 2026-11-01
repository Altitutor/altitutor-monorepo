-- From filtering happens before grouping/pagination; deleted drafts are not live thread content.
DROP FUNCTION public.email_list_threads(text,text,text,integer,integer,text,text);
CREATE FUNCTION public.email_list_threads(p_folder_id text,p_search text,p_assignee text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 50,p_sort text DEFAULT 'received',p_direction text DEFAULT 'desc',p_from text DEFAULT '')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH matching AS (
   SELECT m.* FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id
   WHERE NOT m.removed AND (p_from='' OR lower(btrim(m.data->>'sender'))=ANY(string_to_array(lower(p_from),','))) AND (p_folder_id='' OR m.folder_id=p_folder_id)
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
REVOKE ALL ON FUNCTION public.email_list_threads(text,text,text,integer,integer,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_list_threads(text,text,text,integer,integer,text,text,text) TO authenticated,service_role;

CREATE FUNCTION public.email_sender_options() RETURNS TABLE(email text,name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT lower(btrim(m.data->>'sender')) AS email, max(nullif(m.data->>'senderName','')) AS name
 FROM public.email_messages m WHERE NOT m.removed AND nullif(btrim(m.data->>'sender'),'') IS NOT NULL
 GROUP BY lower(btrim(m.data->>'sender')) ORDER BY lower(btrim(m.data->>'sender'));
$$;
REVOKE ALL ON FUNCTION public.email_sender_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_sender_options() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.email_thread_detail(p_thread_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',t.id,'assignedStaffId',t.assigned_staff_id,'assignedAt',t.assigned_at,
   'links',coalesce((SELECT jsonb_agg(jsonb_build_object('recordType',l.record_type,'recordId',l.record_id,'source',l.source,'label',coalesce(
     CASE l.record_type WHEN 'student' THEN (SELECT concat_ws(' ',s.first_name,s.last_name) FROM public.students s WHERE s.id=l.record_id)
       WHEN 'parent' THEN (SELECT concat_ws(' ',p.first_name,p.last_name) FROM public.parents p WHERE p.id=l.record_id)
       WHEN 'staff' THEN (SELECT concat_ws(' ',s.first_name,s.last_name) FROM public.staff s WHERE s.id=l.record_id)
       WHEN 'onboarding_journey' THEN (SELECT j.label FROM public.onboarding_journeys j WHERE j.id=l.record_id) END,l.record_type)) ORDER BY l.record_type,l.record_id) FROM public.email_record_links l WHERE l.thread_id=t.id),'[]'::jsonb),
   'messages',coalesce((SELECT jsonb_agg(m.data || jsonb_build_object('id',m.id,'threadId',m.thread_id,'folderId',m.folder_id,'removed',m.removed) ORDER BY m.occurred_at,m.id)
     FROM public.email_messages m WHERE m.thread_id=t.id AND (NOT coalesce((m.data->>'draft')::boolean,false) OR (NOT m.removed AND coalesce(m.folder_id,'')<>'deleteditems' AND NOT EXISTS(SELECT 1 FROM public.email_folders f WHERE f.id=m.folder_id AND f.role='deleteditems')))),'[]'::jsonb))
 FROM public.email_threads t WHERE t.id=p_thread_id;
$$;
REVOKE ALL ON FUNCTION public.email_thread_detail(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_thread_detail(text) TO authenticated,service_role;

-- Header enrichment cannot overwrite a body/folder/version already advanced by
-- delta sync. Merge only metadata, and only into the exact observed draft version.
CREATE FUNCTION public.email_cache_draft_reply_targets(p_message_id text,p_change_key text,p_targets text[])
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.email_messages SET data=data || jsonb_build_object('replyToInternetMessageIds',to_jsonb(coalesce(p_targets,'{}'::text[])),'replyTargetVersion',p_change_key)
 WHERE id=p_message_id AND NOT removed AND data->>'changeKey'=p_change_key AND coalesce((data->>'draft')::boolean,false);
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.email_cache_draft_reply_targets(text,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_cache_draft_reply_targets(text,text,text[]) TO service_role;
