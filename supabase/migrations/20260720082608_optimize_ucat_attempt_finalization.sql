-- Collapse the read-then-write question-attempt batch flow into one atomic
-- database call. Set and practice attempts both have a unique
-- (parent_attempt_id, question_id) key, so an UPSERT is faster and removes the
-- race between checking for an existing answer and writing it.
create or replace function public.upsert_ucat_question_attempt_batch(
  p_student_id uuid,
  p_student_question_set_attempt_id uuid,
  p_student_practice_session_id uuid,
  p_attempts jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if (p_student_question_set_attempt_id is null) =
     (p_student_practice_session_id is null) then
    raise exception 'exactly_one_attempt_context_required';
  end if;

  if not jsonb_typeof(coalesce(p_attempts, '[]'::jsonb)) = 'array' then
    raise exception 'attempts_must_be_an_array';
  end if;

  if p_student_question_set_attempt_id is not null then
    if not exists (
      select 1
      from public.student_question_set_attempts attempt
      where attempt.id = p_student_question_set_attempt_id
        and attempt.student_id = p_student_id
        and attempt.completed_at is null
        and attempt.discarded_at is null
        and attempt.expired_at is null
    ) then
      raise exception 'question_set_attempt_is_not_active';
    end if;

    with input as (
      select *
      from jsonb_to_recordset(coalesce(p_attempts, '[]'::jsonb)) as row(
        question_id uuid,
        question_answer_option_id uuid,
        answer_snapshot jsonb,
        has_answer_snapshot boolean,
        is_flagged boolean,
        has_is_flagged boolean,
        is_submitted boolean,
        was_timed boolean,
        has_was_timed boolean,
        mode text,
        score numeric,
        has_score boolean,
        time_spent_milliseconds bigint,
        has_time_spent_milliseconds boolean
      )
    ), authorized as (
      select input.*
      from input
      join public.student_question_set_attempts attempt
        on attempt.id = p_student_question_set_attempt_id
      join public.ucat_questions question on question.id = input.question_id
      join public.question_stems_question_sets membership
        on membership.question_stem_id = question.question_stem_id
       and membership.question_set_id = attempt.question_set_id
    ), written as (
      insert into public.student_question_attempts (
        student_id,
        student_question_set_attempt_id,
        student_practice_session_id,
        learning_module_block_id,
        question_id,
        question_answer_option_id,
        answer_snapshot,
        is_flagged,
        is_submitted,
        time_spent_milliseconds,
        time_spent_seconds,
        was_timed,
        mode,
        score
      )
      select
        p_student_id,
        p_student_question_set_attempt_id,
        null,
        null,
        authorized.question_id,
        authorized.question_answer_option_id,
        case when authorized.has_answer_snapshot
          then authorized.answer_snapshot else null end,
        case when authorized.has_is_flagged
          then coalesce(authorized.is_flagged, false) else false end,
        coalesce(authorized.is_submitted, false),
        case when authorized.has_time_spent_milliseconds
          then greatest(coalesce(authorized.time_spent_milliseconds, 0), 0)
          else null end,
        case
          when authorized.has_time_spent_milliseconds
            and coalesce(authorized.time_spent_milliseconds, 0) > 0
          then ceil(greatest(authorized.time_spent_milliseconds, 0) / 1000.0)::integer
          else null
        end,
        case when authorized.has_was_timed
          then coalesce(authorized.was_timed, false) else false end,
        authorized.mode,
        case when authorized.has_score then coalesce(authorized.score, 0) else 0 end
      from authorized
      on conflict (student_question_set_attempt_id, question_id)
      do update set
        question_answer_option_id = excluded.question_answer_option_id,
        answer_snapshot = case
          when (
            select source.has_answer_snapshot
            from authorized source
            where source.question_id = excluded.question_id
          ) then excluded.answer_snapshot
          else student_question_attempts.answer_snapshot
        end,
        is_flagged = case
          when (
            select source.has_is_flagged
            from authorized source
            where source.question_id = excluded.question_id
          ) then excluded.is_flagged
          else student_question_attempts.is_flagged
        end,
        is_submitted = student_question_attempts.is_submitted or excluded.is_submitted,
        time_spent_milliseconds = case
          when (
            select source.has_time_spent_milliseconds
            from authorized source
            where source.question_id = excluded.question_id
          ) then greatest(
            coalesce(student_question_attempts.time_spent_milliseconds, 0),
            coalesce(excluded.time_spent_milliseconds, 0)
          )
          else student_question_attempts.time_spent_milliseconds
        end,
        time_spent_seconds = case
          when (
            select source.has_time_spent_milliseconds
            from authorized source
            where source.question_id = excluded.question_id
          ) then
            case
              when greatest(
                coalesce(student_question_attempts.time_spent_milliseconds, 0),
                coalesce(excluded.time_spent_milliseconds, 0)
              ) > 0
              then ceil(greatest(
                coalesce(student_question_attempts.time_spent_milliseconds, 0),
                coalesce(excluded.time_spent_milliseconds, 0)
              ) / 1000.0)::integer
              else null
            end
          else student_question_attempts.time_spent_seconds
        end,
        was_timed = case
          when (
            select source.has_was_timed
            from authorized source
            where source.question_id = excluded.question_id
          ) then excluded.was_timed
          else student_question_attempts.was_timed
        end,
        mode = coalesce(excluded.mode, student_question_attempts.mode),
        score = case
          when (
            select source.has_score
            from authorized source
            where source.question_id = excluded.question_id
          ) then excluded.score
          else student_question_attempts.score
        end
      returning 1
    )
    select count(*) into v_count from written;

    if v_count <> jsonb_array_length(p_attempts) then
      raise exception 'question_is_not_part_of_set_attempt';
    end if;
  else
    if not exists (
      select 1
      from public.student_practice_sessions session
      where session.id = p_student_practice_session_id
        and session.student_id = p_student_id
        and session.completed_at is null
        and session.discarded_at is null
        and session.expired_at is null
    ) then
      raise exception 'practice_session_is_not_active';
    end if;

    with input as (
      select *
      from jsonb_to_recordset(coalesce(p_attempts, '[]'::jsonb)) as row(
        question_id uuid,
        question_answer_option_id uuid,
        answer_snapshot jsonb,
        has_answer_snapshot boolean,
        is_flagged boolean,
        has_is_flagged boolean,
        is_submitted boolean,
        was_timed boolean,
        has_was_timed boolean,
        mode text,
        score numeric,
        has_score boolean,
        time_spent_milliseconds bigint,
        has_time_spent_milliseconds boolean
      )
    ), written as (
      insert into public.student_question_attempts (
        student_id,
        student_question_set_attempt_id,
        student_practice_session_id,
        learning_module_block_id,
        question_id,
        question_answer_option_id,
        answer_snapshot,
        is_flagged,
        is_submitted,
        first_seen_at,
        time_spent_milliseconds,
        time_spent_seconds,
        was_timed,
        mode,
        score
      )
      select
        p_student_id,
        null,
        p_student_practice_session_id,
        null,
        input.question_id,
        input.question_answer_option_id,
        case when input.has_answer_snapshot then input.answer_snapshot else null end,
        case when input.has_is_flagged then coalesce(input.is_flagged, false) else false end,
        coalesce(input.is_submitted, false),
        now(),
        case when input.has_time_spent_milliseconds
          then greatest(coalesce(input.time_spent_milliseconds, 0), 0)
          else null end,
        case
          when input.has_time_spent_milliseconds
            and coalesce(input.time_spent_milliseconds, 0) > 0
          then ceil(greatest(input.time_spent_milliseconds, 0) / 1000.0)::integer
          else null
        end,
        case when input.has_was_timed then coalesce(input.was_timed, false) else false end,
        input.mode,
        case when input.has_score then coalesce(input.score, 0) else 0 end
      from input
      on conflict (student_practice_session_id, question_id)
      do update set
        question_answer_option_id = excluded.question_answer_option_id,
        answer_snapshot = case
          when (
            select source.has_answer_snapshot
            from input source
            where source.question_id = excluded.question_id
          ) then excluded.answer_snapshot
          else student_question_attempts.answer_snapshot
        end,
        is_flagged = case
          when (
            select source.has_is_flagged
            from input source
            where source.question_id = excluded.question_id
          ) then excluded.is_flagged
          else student_question_attempts.is_flagged
        end,
        is_submitted = student_question_attempts.is_submitted or excluded.is_submitted,
        first_seen_at = coalesce(student_question_attempts.first_seen_at, excluded.first_seen_at),
        time_spent_milliseconds = case
          when (
            select source.has_time_spent_milliseconds
            from input source
            where source.question_id = excluded.question_id
          ) then greatest(
            coalesce(student_question_attempts.time_spent_milliseconds, 0),
            coalesce(excluded.time_spent_milliseconds, 0)
          )
          else student_question_attempts.time_spent_milliseconds
        end,
        time_spent_seconds = case
          when (
            select source.has_time_spent_milliseconds
            from input source
            where source.question_id = excluded.question_id
          ) then
            case
              when greatest(
                coalesce(student_question_attempts.time_spent_milliseconds, 0),
                coalesce(excluded.time_spent_milliseconds, 0)
              ) > 0
              then ceil(greatest(
                coalesce(student_question_attempts.time_spent_milliseconds, 0),
                coalesce(excluded.time_spent_milliseconds, 0)
              ) / 1000.0)::integer
              else null
            end
          else student_question_attempts.time_spent_seconds
        end,
        was_timed = case
          when (
            select source.has_was_timed
            from input source
            where source.question_id = excluded.question_id
          ) then excluded.was_timed
          else student_question_attempts.was_timed
        end,
        mode = coalesce(excluded.mode, student_question_attempts.mode),
        score = case
          when (
            select source.has_score
            from input source
            where source.question_id = excluded.question_id
          ) then excluded.score
          else student_question_attempts.score
        end
      returning 1
    )
    select count(*) into v_count from written;

    if v_count <> jsonb_array_length(p_attempts) then
      raise exception 'question_attempt_batch_was_not_fully_persisted';
    end if;
  end if;

  return v_count;
end;
$$;

revoke all on function public.upsert_ucat_question_attempt_batch(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.upsert_ucat_question_attempt_batch(
  uuid, uuid, uuid, jsonb
) to service_role;
