-- Persist a practice snapshot and the elapsed interval it closes in one
-- transaction. Previously these were separate requests, so a failure between
-- them could either lose an interval or count it twice when the client retried.
create or replace function public.sync_ucat_practice_attempt_snapshot(
  p_student_id uuid,
  p_session_id uuid,
  p_engine_snapshot jsonb,
  p_current_segment_ends_at timestamptz,
  p_question_active_timing jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_snapshot jsonb;
  v_previous_timing jsonb;
  v_next_snapshot jsonb;
  v_active_timing jsonb := 'null'::jsonb;
  v_now timestamptz := clock_timestamp();
  v_started_at timestamptz;
  v_interval_end timestamptz;
  v_existing_segment_end timestamptz;
  v_previous_segment_end timestamptz;
  v_elapsed_milliseconds bigint;
  v_previous_was_timed boolean;
  v_previous_mode text;
  v_current_mode text;
begin
  select session.engine_snapshot, session.current_segment_ends_at
  into v_existing_snapshot, v_existing_segment_end
  from public.student_practice_sessions session
  where session.id = p_session_id
    and session.student_id = p_student_id
    and session.completed_at is null
    and session.discarded_at is null
    and session.expired_at is null
  for update;

  if not found then
    return null;
  end if;

  v_previous_timing := v_existing_snapshot #> '{state,activeQuestionTiming}';

  if jsonb_typeof(v_previous_timing) = 'object'
    and nullif(v_previous_timing ->> 'questionId', '') is not null
    and nullif(v_previous_timing ->> 'startedAt', '') is not null
  then
    v_started_at := (v_previous_timing ->> 'startedAt')::timestamptz;
    v_interval_end := v_now;

    if nullif(v_previous_timing ->> 'segmentEndsAt', '') is not null then
      v_previous_segment_end :=
        (v_previous_timing ->> 'segmentEndsAt')::timestamptz;
      v_interval_end := least(v_interval_end, v_previous_segment_end);
    elsif v_existing_segment_end is not null then
      v_interval_end := least(v_interval_end, v_existing_segment_end);
    end if;

    v_interval_end := greatest(v_started_at, v_interval_end);
    v_elapsed_milliseconds := greatest(
      0,
      round(extract(epoch from (v_interval_end - v_started_at)) * 1000)::bigint
    );
    v_previous_was_timed :=
      coalesce((v_previous_timing ->> 'wasTimed')::boolean, false);

    -- Untimed practice writes at most 30 seconds per sync. This retains the
    -- existing anti-idle behaviour while keeping the write atomic.
    if not v_previous_was_timed then
      v_elapsed_milliseconds := least(v_elapsed_milliseconds, 30000);
    end if;

    v_previous_mode := case v_previous_timing ->> 'mode'
      when 'questionStem' then 'question_stem'
      when 'questions' then 'question'
      else v_previous_timing ->> 'mode'
    end;

    perform public.increment_ucat_question_active_time(
      p_student_id,
      (v_previous_timing ->> 'questionId')::uuid,
      null,
      p_session_id,
      v_elapsed_milliseconds,
      v_previous_was_timed,
      v_previous_mode
    );
  end if;

  if jsonb_typeof(p_question_active_timing) = 'object'
    and nullif(p_question_active_timing ->> 'questionId', '') is not null
  then
    v_current_mode := case p_question_active_timing ->> 'mode'
      when 'questionStem' then 'question_stem'
      when 'questions' then 'question'
      else p_question_active_timing ->> 'mode'
    end;

    -- A zero-duration upsert records first visibility for practice quota.
    perform public.increment_ucat_question_active_time(
      p_student_id,
      (p_question_active_timing ->> 'questionId')::uuid,
      null,
      p_session_id,
      0,
      coalesce((p_question_active_timing ->> 'wasTimed')::boolean, false),
      v_current_mode
    );

    v_active_timing := p_question_active_timing || jsonb_build_object(
      'startedAt', v_now,
      'segmentEndsAt', p_current_segment_ends_at
    );
  end if;

  v_next_snapshot := jsonb_set(
    p_engine_snapshot,
    '{state,activeQuestionTiming}',
    v_active_timing,
    true
  );

  update public.student_practice_sessions
  set engine_snapshot = v_next_snapshot,
      current_segment_ends_at = p_current_segment_ends_at,
      last_activity_at = v_now
  where id = p_session_id
    and student_id = p_student_id
    and completed_at is null
    and discarded_at is null
    and expired_at is null;

  return v_next_snapshot;
end;
$$;

revoke all on function public.sync_ucat_practice_attempt_snapshot(
  uuid, uuid, jsonb, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.sync_ucat_practice_attempt_snapshot(
  uuid, uuid, jsonb, timestamptz, jsonb
) to service_role;
