-- DEV-277: correspondence references retain individual message IDs, including text email IDs.
create or replace function admin_operations.validate_references(payload jsonb,previous jsonb,document_only boolean)
returns void language plpgsql security definer set search_path='' as $$
declare
  mention jsonb;
  reference_type text;
  reference_id text;
  tab text;
  target uuid;
  exists_target boolean;
begin
  for mention in select value from jsonb_path_query(payload,'$.** ? (@.type == "mention")') value loop
    -- Preserve unresolved historical links during edits; newly introduced links must resolve.
    if previous is not null and exists(
      select 1 from jsonb_path_query(previous,'$.** ? (@.type == "mention")') old_mention
      where old_mention=mention
    ) then continue; end if;
    reference_type := mention#>>'{attrs,type}';
    reference_id := mention#>>'{attrs,id}';
    if document_only and reference_type not in ('note','email','message') then
      raise exception 'Documents support document, email and message references only' using errcode='22023';
    end if;
    if reference_type='email' then
      -- New picker results identify individual emails. Existing thread links remain valid.
      if not exists(select 1 from public.email_messages where id=reference_id)
        and not exists(select 1 from public.email_threads where id=reference_id) then
        raise exception 'Referenced entity not found' using errcode='22023';
      end if;
      continue;
    end if;
    tab := case reference_type
      when 'student' then 'students' when 'parent' then 'parents' when 'staff' then 'staff'
      when 'class' then 'classes' when 'session' then 'sessions' when 'invoice' then 'invoices'
      when 'subject' then 'subjects' when 'topic' then 'topics' when 'file' then 'topics_files'
      when 'note' then 'notes_documents' when 'message' then 'messages'
      when 'adminShift' then 'admin_shifts' when 'admin-shift' then 'admin_shifts'
      when 'tutorLog' then 'tutor_logs' when 'tutor-log' then 'tutor_logs'
      else admin_operations.table_for(reference_type) end;
    if tab is null then raise exception 'Unknown reference type' using errcode='22023'; end if;
    begin target := reference_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid reference ID' using errcode='22023';
    end;
    execute format('select exists(select 1 from public.%I where id=$1)',tab) into exists_target using target;
    if not exists_target then raise exception 'Referenced entity not found' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function admin_operations.validate_references(jsonb,jsonb,boolean) from public,anon,authenticated;
