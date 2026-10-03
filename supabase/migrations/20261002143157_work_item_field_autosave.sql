-- Editors do not hold a lease while someone views or types. A patch compares
-- only its changed fields while holding the record's transaction lock, then
-- reuses the established validation, attribution, history and write guards.
-- Older clients still holding a lease remain protected until they release it.
create function public.admin_work_item_patch(
  p_kind text, p_id uuid, p_changes jsonb, p_expected jsonb, p_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := (select auth.uid());
  client text := coalesce((select auth.jwt())->>'client_id','admin-web');
  tab text; item jsonb; session jsonb; result jsonb;
  field text; allowed text[]; conflicts jsonb := '[]'::jsonb;
  fingerprint text; prior admin_operations.receipts;
begin
  perform admin_operations.assert_actor();
  if p_kind not in ('task','issue','project','document') or p_kind is null or p_id is null
     or p_key is null or length(p_key) not between 1 and 160
     or p_changes is null or jsonb_typeof(p_changes)<>'object'
     or p_expected is null or jsonb_typeof(p_expected)<>'object'
     or octet_length(p_changes::text)+octet_length(p_expected::text)>2000000 then
    raise exception 'Invalid autosave input' using errcode='22023';
  end if;
  allowed := case p_kind
    when 'issue' then array['name','description','status','due_date']
    when 'task' then array['title','description','status','priority','assigned_to','issue_id','project_id','estimate','due_date']
    when 'project' then array['name','description','status','priority','project_lead_id','start_date','target_date','member_ids']
    when 'document' then array['title','content','folder_id','project_id','is_tutor_documentation'] end;
  for field in select jsonb_object_keys(p_changes) loop
    if not field=any(allowed) or not p_expected ? field then
      raise exception 'Changed fields require editable properties and their previous values' using errcode='22023';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_expected))<>(select count(*) from jsonb_object_keys(p_changes)) then
    raise exception 'Previous values must match the changed fields' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_array(p_kind,p_id,p_changes,p_expected)::text);
  -- Same-key retries may overlap after a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended(caller::text||client||'patch:'||p_key,0));
  select * into prior from admin_operations.receipts
    where user_id=caller and client_id=client and request_key='patch:'||p_key;
  if found then
    if prior.fingerprint<>fingerprint then raise exception 'Autosave request key reused' using errcode='22023'; end if;
    return prior.response;
  end if;
  tab := admin_operations.table_for(p_kind);
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tab) into item using p_id;
  if item is null then raise exception 'Work item not found' using errcode='P0002'; end if;
  item := public.admin_work_item_read(p_kind,p_id)->'record';
  for field in select jsonb_object_keys(p_changes) order by 1 loop
    if (item->field) is distinct from (p_expected->field)
       and (item->field) is distinct from (p_changes->field) then
      conflicts := conflicts || jsonb_build_array(field);
    end if;
  end loop;
  if conflicts='[]'::jsonb and p_changes<>'{}'::jsonb then
    session := public.admin_work_item_edit(p_kind,p_id,'acquire');
    if not (session->>'can_edit')::boolean then
      raise exception 'An older editor is still open. Close it before retrying autosave.' using errcode='55P03';
    end if;
    perform set_config('app.work_item_edit_token',session->>'token',true);
    result := admin_operations.admin_work_item_change(p_kind,p_id,(item->>'admin_revision')::bigint,'patch-core:'||p_key,p_changes);
    perform set_config('app.work_item_edit_token','',true);
    perform public.admin_work_item_edit(p_kind,p_id,'release',(session->>'token')::uuid);
    item := result->'record';
  end if;
  result := jsonb_build_object('record',item,'user_id',caller,'conflicts',conflicts);
  insert into admin_operations.receipts(user_id,client_id,request_key,fingerprint,response)
    values(caller,client,'patch:'||p_key,fingerprint,result);
  return result;
end $$;
revoke all on function public.admin_work_item_patch(text,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.admin_work_item_patch(text,uuid,jsonb,jsonb,text) to authenticated;
