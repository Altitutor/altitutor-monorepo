-- SQLSTATE 40001 means serialization_failure. PostgREST 14 retries that code
-- automatically, so using it for an application-level stale revision can keep
-- one request retrying forever. Preserve the optimistic-concurrency failure as
-- an HTTP conflict without marking it as a retryable database transaction.
do $$
declare
  definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.admin_work_item_change(text,uuid,bigint,text,jsonb)'::regprocedure
  ) into definition;

  updated_definition := replace(
    definition,
    'errcode=''40001''',
    'errcode=''PT409'''
  );

  if updated_definition = definition or updated_definition like '%errcode=''40001''%' then
    raise exception 'Expected exactly one stale-revision SQLSTATE in admin_work_item_change';
  end if;

  execute updated_definition;
end
$$;
