-- The active-attempt endpoint is polled during ordinary UCAT navigation. The
-- slot table is the source of truth for whether any resumable attempt exists,
-- so avoid running the write-capable expiry sweep when there is no slot or the
-- slot has been active within the expiry window.
create or replace function public.get_ucat_active_exam_attempt_slot(
  p_student_id uuid
)
returns table (attempt_kind text, attempt_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt_kind text;
  v_attempt_id uuid;
  v_last_activity_at timestamptz;
begin
  select slot.attempt_kind, slot.attempt_id, slot.last_activity_at
  into v_attempt_kind, v_attempt_id, v_last_activity_at
  from public.ucat_active_exam_attempts slot
  where slot.student_id = p_student_id;

  if not found then
    return;
  end if;

  if v_last_activity_at < now() - interval '7 days' then
    perform public.expire_stale_ucat_exam_attempts(p_student_id);
    return query
    select slot.attempt_kind, slot.attempt_id
    from public.ucat_active_exam_attempts slot
    where slot.student_id = p_student_id;
    return;
  end if;

  attempt_kind := v_attempt_kind;
  attempt_id := v_attempt_id;
  return next;
end;
$$;

revoke execute on function public.get_ucat_active_exam_attempt_slot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_ucat_active_exam_attempt_slot(uuid)
  to service_role;
