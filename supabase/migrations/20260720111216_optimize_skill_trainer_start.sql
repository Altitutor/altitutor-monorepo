-- Start a standalone skill-trainer attempt in one short transaction. This
-- keeps quota enforcement and attempt creation atomic while avoiding a long
-- application-level PostgREST waterfall.

create or replace function public.start_ucat_skill_trainer_attempt(
  p_user_id uuid,
  p_trainer_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_student public.students%rowtype;
  v_trainer public.ucat_skill_trainers%rowtype;
  v_config public.ucat_skill_trainer_config%rowtype;
  v_attempt public.student_skill_trainer_attempts%rowtype;
  v_queue uuid[];
  v_config_snapshot jsonb;
  v_progress jsonb;
  v_current_item jsonb;
  v_next_item jsonb;
  v_is_quota_exempt boolean := false;
  v_is_in_person_entitled boolean := false;
  v_quota_limit integer;
  v_quota_period text;
  v_period_start timestamptz;
  v_reset_start timestamptz;
  v_count_start timestamptz;
  v_used integer := 0;
  v_timezone text;
begin
  select student.*
  into v_student
  from public.students student
  where student.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'student_not_found');
  end if;

  select trainer.*
  into v_trainer
  from public.ucat_skill_trainers trainer
  where trainer.key = p_trainer_key
    and trainer.is_enabled = true;

  if not found then
    return jsonb_build_object('status', 'trainer_not_found');
  end if;

  select config.*
  into v_config
  from public.ucat_skill_trainer_config config
  where config.skill_trainer_id = v_trainer.id;

  if not found then
    return jsonb_build_object('status', 'trainer_config_not_found');
  end if;

  -- Expired rows should be completed, while a genuinely active run is
  -- discarded because starting again is an explicit replacement action.
  update public.student_skill_trainer_attempts attempt
  set completed_at = v_now,
      progress = null
  where attempt.student_id = v_student.id
    and attempt.completed_at is null
    and attempt.discarded_at is null
    and attempt.ends_at <= v_now;

  update public.student_skill_trainer_attempts attempt
  set discarded_at = v_now
  where attempt.student_id = v_student.id
    and attempt.completed_at is null
    and attempt.discarded_at is null;

  v_is_in_person_entitled := public.student_has_in_person_ucat_session_resource(
    v_student.id,
    'skill_trainer',
    v_trainer.id
  );
  v_is_quota_exempt := coalesce(
    public.is_ucat_online_quota_exempt(v_student.id),
    false
  );

  if not v_is_in_person_entitled and not v_is_quota_exempt then
    select
      config.free_skill_trainer_limit,
      config.free_skill_trainer_period
    into v_quota_limit, v_quota_period
    from public.ucat_subscription_config config
    order by config.created_at asc
    limit 1;

    if not found then
      return jsonb_build_object('status', 'quota_config_not_found');
    end if;

    v_timezone := coalesce(
      nullif(v_student.timezone, ''),
      'Australia/Adelaide'
    );
    v_period_start := case v_quota_period
      when 'day' then
        date_trunc('day', v_now at time zone v_timezone) at time zone v_timezone
      when 'week' then
        date_trunc('week', v_now at time zone v_timezone) at time zone v_timezone
      when 'month' then
        date_trunc('month', v_now at time zone v_timezone) at time zone v_timezone
      else null
    end;

    if v_period_start is null then
      return jsonb_build_object('status', 'invalid_quota_period');
    end if;

    v_reset_start := public.get_ucat_free_quota_reset_boundary(
      v_student.id,
      'skill_trainer'
    );
    v_count_start := greatest(
      v_period_start,
      coalesce(v_reset_start, v_period_start)
    );

    if v_quota_limit > 0 then
      select count(*)::integer
      into v_used
      from public.student_skill_trainer_attempts attempt
      where attempt.student_id = v_student.id
        and attempt.learning_module_block_id is null
        and attempt.started_at >= v_count_start
        and not public.student_has_in_person_ucat_session_resource(
          v_student.id,
          'skill_trainer',
          attempt.skill_trainer_id
        );
    end if;

    if v_quota_limit = 0 or v_used >= v_quota_limit then
      insert into public.notifications (
        student_id,
        notification_type,
        app_scope,
        title,
        body,
        action_url,
        metadata,
        dedupe_key
      ) values (
        v_student.id,
        'ucat.quota.limit_reached',
        'ucat_web',
        'You''ve reached your Skill trainer attempts limit',
        'Your UCAT Free skill trainer attempts allowance will refresh when the current ' ||
          v_quota_period || ' quota period resets, or you can upgrade for unlimited access.',
        '/settings/plan',
        jsonb_build_object(
          'quota_area', 'skill_trainer',
          'quota_period', v_quota_period,
          'used', v_used,
          'limit', v_quota_limit,
          'period_start', v_count_start
        ),
        'ucat:quota-limit:' || v_student.id::text || ':skill_trainer:' ||
          to_char(
            v_count_start at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
      )
      on conflict (dedupe_key) do nothing;

      return jsonb_build_object(
        'status', 'quota_exceeded',
        'quota', jsonb_build_object(
          'code', 'QUOTA_EXCEEDED',
          'area', 'skill_trainer',
          'used', v_used,
          'limit', v_quota_limit,
          'period', v_quota_period
        )
      );
    end if;
  end if;

  v_queue := public.get_skill_trainer_item_queue(v_trainer.id, 64);
  if coalesce(array_length(v_queue, 1), 0) = 0 then
    return jsonb_build_object('status', 'no_items_available');
  end if;

  v_config_snapshot := jsonb_build_object(
    'time_limit_seconds', v_config.time_limit_seconds,
    'points_correct', v_config.points_correct,
    'points_wrong', v_config.points_wrong,
    'streak_enabled', true,
    'streak_multiplier_steps', v_config.streak_multiplier_steps,
    'speed_bonus_enabled', v_config.speed_bonus_enabled,
    'speed_bonus_max_points', v_config.speed_bonus_max_points,
    'speed_bonus_window_seconds', v_config.speed_bonus_window_seconds,
    'trainer_key', v_trainer.key
  );
  v_progress := case v_trainer.key
    when 'find_word' then
      jsonb_build_object('type', 'find_word', 'placed_keyword_ids', jsonb_build_array())
    when 'find_concept' then
      jsonb_build_object(
        'type',
        'find_concept',
        'found_occurrence_indexes',
        jsonb_build_array()
      )
    else jsonb_build_object('type', v_trainer.key)
  end;

  insert into public.student_skill_trainer_attempts (
    student_id,
    skill_trainer_id,
    item_queue_snapshot,
    current_item_index,
    current_item_started_at,
    progress,
    config_snapshot,
    ends_at,
    started_at
  ) values (
    v_student.id,
    v_trainer.id,
    to_jsonb(v_queue),
    0,
    v_now,
    v_progress,
    v_config_snapshot,
    v_now + make_interval(secs => v_config.time_limit_seconds),
    v_now
  )
  returning * into v_attempt;

  select jsonb_build_object('id', item.id, 'content', item.content)
  into v_current_item
  from public.ucat_skill_trainer_items item
  where item.id = v_queue[1];

  select jsonb_build_object('id', item.id, 'content', item.content)
  into v_next_item
  from public.ucat_skill_trainer_items item
  where item.id = v_queue[2];

  return jsonb_build_object(
    'status', 'started',
    'state', jsonb_build_object(
      'attempt', to_jsonb(v_attempt) || jsonb_build_object(
        'trainer_key', v_trainer.key
      ),
      'currentItem', v_current_item,
      'nextItem', v_next_item,
      'remainingSeconds', v_config.time_limit_seconds,
      'isExpired', false,
      'isCompleted', false
    )
  );
end;
$$;

revoke all on function public.start_ucat_skill_trainer_attempt(uuid, text)
  from public, anon, authenticated;
grant execute on function public.start_ucat_skill_trainer_attempt(uuid, text)
  to service_role;

comment on function public.start_ucat_skill_trainer_attempt(uuid, text) is
  'Atomically enforces standalone skill-trainer quota, replaces an active run, creates the attempt, and returns its first two items.';

-- The app and learning-module APIs now use the catalog tables directly. This
-- compatibility view has no runtime consumers.
drop view if exists public.vstudent_ucat_skill_trainers;
