-- Preserve an action that reached the API at the deadline even if database
-- processing finishes just after the attempt expires. The timestamp is added
-- by the trusted server route and the grace only covers normal request latency.
create or replace function public.commit_student_skill_trainer_action(
  p_attempt_id uuid,
  p_student_id uuid,
  p_action_id uuid,
  p_expected_version bigint,
  p_expected_item_id uuid,
  p_score numeric,
  p_streak_count integer,
  p_progress jsonb,
  p_item_queue_snapshot jsonb,
  p_current_item_index integer,
  p_current_item_started_at timestamptz,
  p_item_completed boolean,
  p_score_delta numeric,
  p_result jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt public.student_skill_trainer_attempts%rowtype;
  v_applied_version bigint;
  v_action_received_at timestamptz;
begin
  select *
  into v_attempt
  from public.student_skill_trainer_attempts
  where id = p_attempt_id
    and student_id = p_student_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select applied_version
  into v_applied_version
  from public.student_skill_trainer_action_receipts
  where skill_trainer_attempt_id = p_attempt_id
    and action_id = p_action_id;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'version', v_applied_version
    );
  end if;

  if jsonb_typeof(coalesce(p_result, '{}'::jsonb)->'action_received_at') = 'string' then
    v_action_received_at := (p_result->>'action_received_at')::timestamptz;
  end if;

  if v_attempt.completed_at is not null
     or v_attempt.discarded_at is not null then
    return jsonb_build_object('status', 'completed', 'version', v_attempt.version);
  end if;

  if v_attempt.ends_at <= now()
     and (
       v_action_received_at is null
       or v_action_received_at > v_attempt.ends_at + interval '3 seconds'
       or v_action_received_at > now() + interval '1 second'
     ) then
    return jsonb_build_object('status', 'completed', 'version', v_attempt.version);
  end if;

  if v_attempt.version <> p_expected_version then
    return jsonb_build_object('status', 'stale', 'version', v_attempt.version);
  end if;

  if (v_attempt.item_queue_snapshot ->> v_attempt.current_item_index)::uuid
      is distinct from p_expected_item_id then
    return jsonb_build_object('status', 'stale', 'version', v_attempt.version);
  end if;

  update public.student_skill_trainer_attempts
  set score = p_score,
      streak_count = p_streak_count,
      progress = p_progress,
      item_queue_snapshot = p_item_queue_snapshot,
      current_item_index = p_current_item_index,
      current_item_started_at = p_current_item_started_at,
      version = version + 1
  where id = p_attempt_id
  returning version into v_applied_version;

  if p_item_completed then
    insert into public.student_skill_trainer_attempt_items (
      skill_trainer_attempt_id,
      skill_trainer_item_id,
      score_delta,
      result
    ) values (
      p_attempt_id,
      p_expected_item_id,
      p_score_delta,
      coalesce(p_result, '{}'::jsonb)
    );
  end if;

  insert into public.student_skill_trainer_action_receipts (
    skill_trainer_attempt_id,
    action_id,
    skill_trainer_item_id,
    applied_version,
    item_completed,
    score_delta,
    result
  ) values (
    p_attempt_id,
    p_action_id,
    p_expected_item_id,
    v_applied_version,
    p_item_completed,
    p_score_delta,
    coalesce(p_result, '{}'::jsonb)
  );

  return jsonb_build_object('status', 'applied', 'version', v_applied_version);
end;
$$;

revoke all on function public.commit_student_skill_trainer_action(
  uuid, uuid, uuid, bigint, uuid, numeric, integer, jsonb, jsonb, integer,
  timestamptz, boolean, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_student_skill_trainer_action(
  uuid, uuid, uuid, bigint, uuid, numeric, integer, jsonb, jsonb, integer,
  timestamptz, boolean, numeric, jsonb
) to service_role;
