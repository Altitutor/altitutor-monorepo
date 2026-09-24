-- One editor per record. Tokens are issued by the server and never revived.
create table admin_operations.edit_sessions (
  kind text not null check (kind in ('task','issue','project','document')),
  entity_id uuid not null,
  token uuid not null default gen_random_uuid(),
  user_id uuid not null,
  client_id text not null,
  staff_id uuid not null,
  expires_at timestamptz not null,
  preview jsonb,
  primary key(kind, entity_id)
);
revoke all on admin_operations.edit_sessions from public, anon, authenticated;

-- Keep the established validation, attribution and history implementation private.
alter function public.admin_work_item_change(text,uuid,bigint,text,jsonb) set schema admin_operations;
revoke all on function admin_operations.admin_work_item_change(text,uuid,bigint,text,jsonb) from public,anon,authenticated;

create function public.admin_work_item_edit(
  p_kind text, p_id uuid, p_action text, p_token uuid default null,
  p_changes jsonb default null, p_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := admin_operations.assert_actor();
  caller uuid := (select auth.uid());
  client text := coalesce((select auth.jwt())->>'client_id','admin-web');
  tab text := admin_operations.table_for(p_kind);
  item jsonb; lease admin_operations.edit_sessions; owns boolean; owner_name text; result jsonb;
  prior admin_operations.receipts; fingerprint text;
begin
  if p_kind not in ('task','issue','project','document') or p_id is null then
    raise exception 'Unsupported editor' using errcode='22023';
  end if;
  -- Every lease operation and write takes the entity lock first.
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tab) into item using p_id;
  if item is null then raise exception 'Work item not found' using errcode='P0002'; end if;
  select * into lease from admin_operations.edit_sessions where kind=p_kind and entity_id=p_id;
  owns := coalesce(lease.token=p_token and lease.user_id=caller and lease.client_id=client and lease.expires_at>clock_timestamp(),false);
  if p_action='acquire' then
    if lease.expires_at is null or lease.expires_at<=clock_timestamp() then
      insert into admin_operations.edit_sessions(kind,entity_id,user_id,client_id,staff_id,expires_at)
      values(p_kind,p_id,caller,client,actor,clock_timestamp()+interval '45 seconds')
      on conflict(kind,entity_id) do update set token=gen_random_uuid(),user_id=caller,client_id=client,
        staff_id=actor,expires_at=clock_timestamp()+interval '45 seconds',preview=null
      returning * into lease;
      owns := true;
    end if;
  elsif p_action='read' then null;
  elsif p_action='release' then
    if owns then
      update admin_operations.edit_sessions set expires_at=clock_timestamp(),preview=null where kind=p_kind and entity_id=p_id;
      lease.preview := null; lease.expires_at := clock_timestamp(); owns := false;
    end if;
  elsif p_action in ('heartbeat','preview','save','delete') then
    if not owns then raise exception 'Your editing session ended. Your draft is safe; open a fresh editing session before saving.' using errcode='55P03'; end if;
    if p_action='heartbeat' then
      update admin_operations.edit_sessions set expires_at=clock_timestamp()+interval '45 seconds'
      where kind=p_kind and entity_id=p_id returning * into lease;
    elsif p_action='preview' then
      if p_changes is not null and (jsonb_typeof(p_changes)<>'object' or octet_length(p_changes::text)>1000000) then
        raise exception 'Invalid preview' using errcode='22023';
      end if;
      update admin_operations.edit_sessions set preview=p_changes where kind=p_kind and entity_id=p_id returning * into lease;
    elsif p_action='save' then
      if p_key is null or length(p_key) not between 1 and 160 then raise exception 'Save request key required' using errcode='22023'; end if;
      fingerprint := md5(jsonb_build_array(p_kind,p_id,p_token,p_changes)::text);
      select * into prior from admin_operations.receipts where user_id=caller and client_id=client and request_key='edit:'||p_key;
      if found then
        if prior.fingerprint<>fingerprint then raise exception 'Save request key reused' using errcode='22023'; end if;
        return prior.response;
      end if;
      perform set_config('app.work_item_edit_token',p_token::text,true);
      result := admin_operations.admin_work_item_change(p_kind,p_id,(item->>'admin_revision')::bigint,'core:'||p_key,p_changes);
      perform set_config('app.work_item_edit_token','',true);
      update admin_operations.edit_sessions set preview=null where kind=p_kind and entity_id=p_id;
      lease.preview := null;
      item := result->'record';
    else
      perform set_config('app.work_item_edit_token',p_token::text,true);
      execute format('delete from public.%I where id=$1',tab) using p_id;
      perform set_config('app.work_item_edit_token','',true);
      delete from admin_operations.edit_sessions where kind=p_kind and entity_id=p_id;
      return jsonb_build_object('deleted',true);
    end if;
  else raise exception 'Unknown editor operation' using errcode='22023';
  end if;
  select concat_ws(' ',first_name,last_name) into owner_name from public.staff where id=lease.staff_id;
  -- No other session can read a save token, even another tab of the same user.
  result := jsonb_build_object('record',(public.admin_work_item_read(p_kind,p_id)->'record'),
    'user_id',caller,'token',case when owns then lease.token else null end,'can_edit',owns,
    'owner',case when lease.expires_at>clock_timestamp() then owner_name else null end,
    'expires_at',case when lease.expires_at>clock_timestamp() then lease.expires_at else null end,
    'preview',case when lease.expires_at>clock_timestamp() then lease.preview else null end);
  if p_action='save' then
    insert into admin_operations.receipts(user_id,client_id,request_key,fingerprint,response)
    values(caller,client,'edit:'||p_key,fingerprint,result);
  end if;
  return result;
end $$;
revoke all on function public.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) from public,anon;
grant execute on function public.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) to authenticated;

-- Short, non-editor operations (boards and MCP) acquire a lease for their transaction.
-- Their existing read revision still protects the gap before the transaction starts.
create function public.admin_work_item_change(p_kind text,p_id uuid default null,p_revision bigint default null,p_key text default null,p_changes jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare session jsonb; result jsonb;
begin
  perform admin_operations.assert_actor();
  if p_id is not null and p_kind in ('task','issue','project','document') then
    session := public.admin_work_item_edit(p_kind,p_id,'acquire');
    if not (session->>'can_edit')::boolean then raise exception 'This item is being edited. Try again after its editor closes it.' using errcode='55P03'; end if;
    perform set_config('app.work_item_edit_token',session->>'token',true);
  end if;
  result := admin_operations.admin_work_item_change(p_kind,p_id,p_revision,p_key,p_changes);
  perform set_config('app.work_item_edit_token','',true);
  if session is not null then perform public.admin_work_item_edit(p_kind,p_id,'release',(session->>'token')::uuid); end if;
  return result;
end $$;
revoke all on function public.admin_work_item_change(text,uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.admin_work_item_change(text,uuid,bigint,text,jsonb) to authenticated;

create function admin_operations.enforce_edit_session() returns trigger language plpgsql security definer set search_path='' as $$
declare lease admin_operations.edit_sessions; token text := current_setting('app.work_item_edit_token',true);
begin
  select * into lease from admin_operations.edit_sessions where kind=tg_argv[0] and entity_id=old.id;
  if coalesce(token,'')<>'' and lease.token::text=token and lease.user_id=(select auth.uid())
     and lease.client_id=coalesce((select auth.jwt())->>'client_id','admin-web') and lease.expires_at>clock_timestamp() then
    return case when tg_op='DELETE' then old else new end;
  end if;
  -- Referential actions may clear links on unlocked child records.
  if pg_trigger_depth()>1 and (lease.expires_at is null or lease.expires_at<=clock_timestamp()) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  -- Trusted maintenance can work on unlocked records; never bypass a live editor.
  if (select auth.uid()) is null and (lease.expires_at is null or lease.expires_at<=clock_timestamp()) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  raise exception 'A valid editing session is required' using errcode='55P03';
end $$;
revoke all on function admin_operations.enforce_edit_session() from public,anon,authenticated;
create trigger enforce_edit_session before update or delete on public.tasks for each row execute function admin_operations.enforce_edit_session('task');
create trigger enforce_edit_session before update or delete on public.issues for each row execute function admin_operations.enforce_edit_session('issue');
create trigger enforce_edit_session before update or delete on public.projects for each row execute function admin_operations.enforce_edit_session('project');
create trigger enforce_edit_session before update or delete on public.notes_documents for each row execute function admin_operations.enforce_edit_session('document');
