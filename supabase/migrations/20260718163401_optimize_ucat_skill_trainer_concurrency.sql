-- Make skill-trainer actions atomic, versioned and safely retryable.

alter table public.student_skill_trainer_attempts
  add column if not exists version bigint not null default 0;

create table if not exists public.student_skill_trainer_action_receipts (
  skill_trainer_attempt_id uuid not null
    references public.student_skill_trainer_attempts(id) on delete cascade,
  action_id uuid not null,
  skill_trainer_item_id uuid not null
    references public.ucat_skill_trainer_items(id) on delete restrict,
  applied_version bigint not null,
  item_completed boolean not null,
  score_delta numeric not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (skill_trainer_attempt_id, action_id)
);

alter table public.student_skill_trainer_action_receipts enable row level security;
revoke all on table public.student_skill_trainer_action_receipts from public, anon, authenticated;
grant all on table public.student_skill_trainer_action_receipts to service_role;

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

  if v_attempt.completed_at is not null or v_attempt.ends_at <= now() then
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

revoke execute on function public.commit_student_skill_trainer_action(
  uuid, uuid, uuid, bigint, uuid, numeric, integer, jsonb, jsonb, integer,
  timestamptz, boolean, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_student_skill_trainer_action(
  uuid, uuid, uuid, bigint, uuid, numeric, integer, jsonb, jsonb, integer,
  timestamptz, boolean, numeric, jsonb
) to service_role;

create or replace function public.get_skill_trainer_item_queue(
  p_skill_trainer_id uuid,
  p_limit integer default 64
)
returns uuid[]
language sql
volatile
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(item.id), '{}'::uuid[])
  from (
    select i.id
    from public.ucat_skill_trainer_items i
    where i.skill_trainer_id = p_skill_trainer_id
      and i.is_active = true
      and i.approval_status = 'approved'
      and i.deleted_at is null
    order by random()
    limit greatest(2, least(coalesce(p_limit, 64), 128))
  ) item;
$$;

revoke execute on function public.get_skill_trainer_item_queue(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_skill_trainer_item_queue(uuid, integer)
  to service_role;

create or replace function public.get_ucat_active_exam_attempt_slot(
  p_student_id uuid
)
returns table (attempt_kind text, attempt_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.expire_stale_ucat_exam_attempts(p_student_id);
  return query
  select slot.attempt_kind, slot.attempt_id
  from public.ucat_active_exam_attempts slot
  where slot.student_id = p_student_id;
end;
$$;

revoke execute on function public.get_ucat_active_exam_attempt_slot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_ucat_active_exam_attempt_slot(uuid)
  to service_role;

create or replace function public.create_ucat_exam_attempt_records(
  p_attempt_kind text,
  p_student_id uuid,
  p_attempt_id uuid,
  p_resource_id uuid,
  p_engine_snapshot jsonb,
  p_current_segment_ends_at timestamptz,
  p_was_timed boolean,
  p_first_set_id uuid default null,
  p_first_set_attempt_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_attempt_kind = 'set' then
    insert into public.student_question_set_attempts (
      id, student_id, question_set_id, was_timed, engine_snapshot,
      current_segment_ends_at, last_activity_at
    ) values (
      p_attempt_id, p_student_id, p_resource_id, p_was_timed,
      p_engine_snapshot, p_current_segment_ends_at, now()
    );
  elsif p_attempt_kind = 'mock' then
    insert into public.student_ucat_mock_attempts (
      id, student_id, ucat_mock_id, engine_snapshot,
      current_segment_ends_at, last_activity_at, was_timed
    ) values (
      p_attempt_id, p_student_id, p_resource_id, p_engine_snapshot,
      p_current_segment_ends_at, now(), p_was_timed
    );

    if p_first_set_id is not null and p_first_set_attempt_id is not null then
      insert into public.student_question_set_attempts (
        id, student_id, question_set_id, student_ucat_mock_attempt_id,
        was_timed
      ) values (
        p_first_set_attempt_id, p_student_id, p_first_set_id, p_attempt_id,
        p_was_timed
      );
    end if;
  else
    raise exception using errcode = '22023', message = 'Invalid exam attempt kind';
  end if;
end;
$$;

revoke execute on function public.create_ucat_exam_attempt_records(
  text, uuid, uuid, uuid, jsonb, timestamptz, boolean, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_ucat_exam_attempt_records(
  text, uuid, uuid, uuid, jsonb, timestamptz, boolean, uuid, uuid
) to service_role;
