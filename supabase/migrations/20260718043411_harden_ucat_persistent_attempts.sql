-- Harden persistent UCAT practice, set and mock attempts.
-- All functions introduced here are server-only; the web app calls them with
-- the service role after authenticating the student.

alter table public.student_question_set_attempts
  add column if not exists last_activity_at timestamptz,
  add column if not exists discarded_at timestamptz,
  add column if not exists expired_at timestamptz;

alter table public.student_ucat_mock_attempts
  add column if not exists last_activity_at timestamptz,
  add column if not exists discarded_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists was_timed boolean not null default false;

alter table public.student_practice_sessions
  add column if not exists last_activity_at timestamptz,
  add column if not exists discarded_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists was_timed boolean not null default false;

alter table public.student_question_attempts
  add column if not exists first_seen_at timestamptz,
  add column if not exists time_spent_milliseconds bigint;

update public.student_question_set_attempts
set last_activity_at = coalesce(last_activity_at, completed_at, attempted_at);

update public.student_ucat_mock_attempts
set last_activity_at = coalesce(last_activity_at, completed_at, attempted_at);

update public.student_practice_sessions
set last_activity_at = coalesce(last_activity_at, completed_at, started_at);

update public.student_question_attempts
set
  first_seen_at = coalesce(first_seen_at, attempted_at),
  time_spent_milliseconds = coalesce(
    time_spent_milliseconds,
    time_spent_seconds::bigint * 1000
  )
where student_practice_session_id is not null
   or time_spent_seconds is not null
   or question_answer_option_id is not null
   or answer_snapshot is not null
   or is_submitted;

alter table public.student_question_set_attempts
  alter column last_activity_at set default now();
alter table public.student_ucat_mock_attempts
  alter column last_activity_at set default now();
alter table public.student_practice_sessions
  alter column last_activity_at set default now();

alter table public.student_question_set_attempts
  drop constraint if exists student_question_set_attempts_one_terminal_state;
alter table public.student_question_set_attempts
  add constraint student_question_set_attempts_one_terminal_state
  check (num_nonnulls(completed_at, discarded_at, expired_at) <= 1) not valid;
alter table public.student_ucat_mock_attempts
  drop constraint if exists student_ucat_mock_attempts_one_terminal_state;
alter table public.student_ucat_mock_attempts
  add constraint student_ucat_mock_attempts_one_terminal_state
  check (num_nonnulls(completed_at, discarded_at, expired_at) <= 1) not valid;
alter table public.student_practice_sessions
  drop constraint if exists student_practice_sessions_one_terminal_state;
alter table public.student_practice_sessions
  add constraint student_practice_sessions_one_terminal_state
  check (num_nonnulls(completed_at, discarded_at, expired_at) <= 1) not valid;

alter table public.student_question_set_attempts
  validate constraint student_question_set_attempts_one_terminal_state;
alter table public.student_ucat_mock_attempts
  validate constraint student_ucat_mock_attempts_one_terminal_state;
alter table public.student_practice_sessions
  validate constraint student_practice_sessions_one_terminal_state;

-- Keep the most recently active cross-kind attempt and make older conflicts
-- explicit audit-only expiries before installing the global slot registry.
with candidates as (
  select id, student_id, 'set'::text as kind, attempted_at as started_at
  from public.student_question_set_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null and student_ucat_mock_attempt_id is null
  union all
  select id, student_id, 'mock', attempted_at
  from public.student_ucat_mock_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
  union all
  select id, student_id, 'practice', started_at
  from public.student_practice_sessions
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
), ranked as (
  select *, row_number() over (
    partition by student_id order by started_at desc, id desc
  ) as position
  from candidates
)
update public.student_question_set_attempts attempt
set expired_at = now()
from ranked
where ranked.kind = 'set' and ranked.position > 1 and attempt.id = ranked.id;

with candidates as (
  select id, student_id, attempted_at as started_at
  from public.student_ucat_mock_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
  union all
  select id, student_id, started_at
  from public.student_practice_sessions
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
  union all
  select id, student_id, attempted_at
  from public.student_question_set_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null and student_ucat_mock_attempt_id is null
), ranked as (
  select *, row_number() over (
    partition by student_id order by started_at desc, id desc
  ) as position
  from candidates
)
update public.student_ucat_mock_attempts attempt
set expired_at = now()
from ranked
where ranked.position > 1 and attempt.id = ranked.id;

-- The previous statements can change the ranking, so expire remaining older
-- practice rows against the now-current cross-kind candidates.
with candidates as (
  select id, student_id, attempted_at as started_at
  from public.student_question_set_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null and student_ucat_mock_attempt_id is null
  union all
  select id, student_id, attempted_at
  from public.student_ucat_mock_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
  union all
  select id, student_id, started_at
  from public.student_practice_sessions
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
), ranked as (
  select *, row_number() over (
    partition by student_id order by started_at desc, id desc
  ) as position
  from candidates
)
update public.student_practice_sessions attempt
set expired_at = now()
from ranked
where ranked.position > 1 and attempt.id = ranked.id;

create table if not exists public.ucat_active_exam_attempts (
  student_id uuid primary key references public.students(id) on delete cascade,
  attempt_kind text not null check (attempt_kind in ('set', 'mock', 'practice')),
  attempt_id uuid not null unique,
  last_activity_at timestamptz not null default now()
);

alter table public.ucat_active_exam_attempts enable row level security;
revoke all on public.ucat_active_exam_attempts from anon, authenticated;
grant select, insert, update, delete on public.ucat_active_exam_attempts to service_role;

create or replace function public.sync_ucat_active_exam_attempt_slot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
  v_is_active boolean;
begin
  v_kind := case tg_table_name
    when 'student_question_set_attempts' then 'set'
    when 'student_ucat_mock_attempts' then 'mock'
    else 'practice'
  end;
  v_is_active := new.completed_at is null
    and new.discarded_at is null
    and new.expired_at is null
    and new.engine_snapshot is not null;
  if tg_table_name = 'student_question_set_attempts' then
    v_is_active := v_is_active and new.student_ucat_mock_attempt_id is null;
  end if;

  if v_is_active then
    insert into public.ucat_active_exam_attempts (
      student_id, attempt_kind, attempt_id, last_activity_at
    ) values (
      new.student_id, v_kind, new.id, coalesce(new.last_activity_at, now())
    )
    on conflict (student_id) do update
      set last_activity_at = excluded.last_activity_at
      where public.ucat_active_exam_attempts.attempt_id = excluded.attempt_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'EXAM_ATTEMPT_IN_PROGRESS';
    end if;
  else
    delete from public.ucat_active_exam_attempts
    where student_id = new.student_id and attempt_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_ucat_active_exam_attempt_slot() from public, anon, authenticated;
grant execute on function public.sync_ucat_active_exam_attempt_slot() to service_role;

drop trigger if exists sync_ucat_set_attempt_slot on public.student_question_set_attempts;
create trigger sync_ucat_set_attempt_slot
after insert or update of engine_snapshot, completed_at, discarded_at, expired_at, last_activity_at
on public.student_question_set_attempts
for each row execute function public.sync_ucat_active_exam_attempt_slot();

drop trigger if exists sync_ucat_mock_attempt_slot on public.student_ucat_mock_attempts;
create trigger sync_ucat_mock_attempt_slot
after insert or update of engine_snapshot, completed_at, discarded_at, expired_at, last_activity_at
on public.student_ucat_mock_attempts
for each row execute function public.sync_ucat_active_exam_attempt_slot();

drop trigger if exists sync_ucat_practice_attempt_slot on public.student_practice_sessions;
create trigger sync_ucat_practice_attempt_slot
after insert or update of engine_snapshot, completed_at, discarded_at, expired_at, last_activity_at
on public.student_practice_sessions
for each row execute function public.sync_ucat_active_exam_attempt_slot();

insert into public.ucat_active_exam_attempts (student_id, attempt_kind, attempt_id, last_activity_at)
select student_id, kind, id, last_activity_at
from (
  select id, student_id, 'set'::text as kind, last_activity_at
  from public.student_question_set_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null and student_ucat_mock_attempt_id is null
  union all
  select id, student_id, 'mock', last_activity_at
  from public.student_ucat_mock_attempts
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
  union all
  select id, student_id, 'practice', last_activity_at
  from public.student_practice_sessions
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null
) active
on conflict (student_id) do update
set
  attempt_kind = excluded.attempt_kind,
  attempt_id = excluded.attempt_id,
  last_activity_at = excluded.last_activity_at;

-- Consolidate only resumable-context duplicates. Standalone practice may
-- intentionally contain repeat attempts for the same question.
with grouped as (
  select
    student_question_set_attempt_id,
    question_id,
    max(time_spent_milliseconds) as max_milliseconds,
    max(time_spent_seconds) as max_seconds,
    min(first_seen_at) as first_seen_at
  from public.student_question_attempts
  where student_question_set_attempt_id is not null and question_id is not null
  group by student_question_set_attempt_id, question_id
), keepers as (
  select distinct on (student_question_set_attempt_id, question_id)
    id, student_question_set_attempt_id, question_id
  from public.student_question_attempts
  where student_question_set_attempt_id is not null and question_id is not null
  order by student_question_set_attempt_id, question_id,
    is_submitted desc, attempted_at desc, id desc
)
update public.student_question_attempts attempt
set
  time_spent_milliseconds = grouped.max_milliseconds,
  time_spent_seconds = grouped.max_seconds,
  first_seen_at = grouped.first_seen_at
from keepers
join grouped using (student_question_set_attempt_id, question_id)
where attempt.id = keepers.id;

with ranked as (
  select id,
    row_number() over (
      partition by student_question_set_attempt_id, question_id
      order by is_submitted desc, attempted_at desc, id desc
    ) as position
  from public.student_question_attempts
  where student_question_set_attempt_id is not null and question_id is not null
)
delete from public.student_question_attempts attempt
using ranked
where ranked.position > 1 and attempt.id = ranked.id;

with grouped as (
  select
    student_practice_session_id,
    question_id,
    max(time_spent_milliseconds) as max_milliseconds,
    max(time_spent_seconds) as max_seconds,
    min(first_seen_at) as first_seen_at
  from public.student_question_attempts
  where student_practice_session_id is not null
    and student_question_set_attempt_id is null
    and question_id is not null
  group by student_practice_session_id, question_id
), keepers as (
  select distinct on (student_practice_session_id, question_id)
    id, student_practice_session_id, question_id
  from public.student_question_attempts
  where student_practice_session_id is not null
    and student_question_set_attempt_id is null
    and question_id is not null
  order by student_practice_session_id, question_id,
    is_submitted desc, attempted_at desc, id desc
)
update public.student_question_attempts attempt
set
  time_spent_milliseconds = grouped.max_milliseconds,
  time_spent_seconds = grouped.max_seconds,
  first_seen_at = grouped.first_seen_at
from keepers
join grouped using (student_practice_session_id, question_id)
where attempt.id = keepers.id;

with ranked as (
  select id,
    row_number() over (
      partition by student_practice_session_id, question_id
      order by is_submitted desc, attempted_at desc, id desc
    ) as position
  from public.student_question_attempts
  where student_practice_session_id is not null
    and student_question_set_attempt_id is null
    and question_id is not null
)
delete from public.student_question_attempts attempt
using ranked
where ranked.position > 1 and attempt.id = ranked.id;

create unique index if not exists student_question_attempts_set_question_unique
  on public.student_question_attempts (student_question_set_attempt_id, question_id);

create unique index if not exists student_question_attempts_practice_question_unique
  on public.student_question_attempts (student_practice_session_id, question_id);

create unique index if not exists student_question_set_attempts_mock_set_unique
  on public.student_question_set_attempts (student_ucat_mock_attempt_id, question_set_id);

create index if not exists student_question_attempts_practice_seen_idx
  on public.student_question_attempts (student_id, first_seen_at, question_id)
  where student_practice_session_id is not null
    and student_question_set_attempt_id is null
    and first_seen_at is not null;

create index if not exists student_question_set_attempts_active_idx
  on public.student_question_set_attempts (student_id, last_activity_at desc)
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null and student_ucat_mock_attempt_id is null;

create index if not exists student_ucat_mock_attempts_active_idx
  on public.student_ucat_mock_attempts (student_id, last_activity_at desc)
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null;

create index if not exists student_practice_sessions_active_idx
  on public.student_practice_sessions (student_id, last_activity_at desc)
  where completed_at is null and discarded_at is null and expired_at is null
    and engine_snapshot is not null;

create or replace function public.increment_ucat_question_active_time(
  p_student_id uuid,
  p_question_id uuid,
  p_set_attempt_id uuid,
  p_practice_session_id uuid,
  p_elapsed_milliseconds bigint,
  p_was_timed boolean,
  p_mode text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_set_attempt_id is not null then
    insert into public.student_question_attempts (
      student_id, student_question_set_attempt_id, student_practice_session_id,
      question_id, question_answer_option_id, answer_snapshot, is_flagged,
      is_submitted, time_spent_seconds, time_spent_milliseconds, first_seen_at,
      was_timed, mode
    ) values (
      p_student_id, p_set_attempt_id, null, p_question_id, null, null, false,
      false, nullif((greatest(p_elapsed_milliseconds, 0) + 999) / 1000, 0),
      greatest(p_elapsed_milliseconds, 0), now(), p_was_timed, p_mode
    )
    on conflict (student_question_set_attempt_id, question_id)
    do update set
      time_spent_milliseconds = coalesce(public.student_question_attempts.time_spent_milliseconds, 0)
        + greatest(excluded.time_spent_milliseconds, 0),
      time_spent_seconds = nullif((coalesce(public.student_question_attempts.time_spent_milliseconds, 0)
        + greatest(excluded.time_spent_milliseconds, 0) + 999) / 1000, 0),
      first_seen_at = coalesce(public.student_question_attempts.first_seen_at, excluded.first_seen_at),
      was_timed = excluded.was_timed,
      mode = excluded.mode;
  elsif p_practice_session_id is not null then
    insert into public.student_question_attempts (
      student_id, student_question_set_attempt_id, student_practice_session_id,
      question_id, question_answer_option_id, answer_snapshot, is_flagged,
      is_submitted, time_spent_seconds, time_spent_milliseconds, first_seen_at,
      was_timed, mode
    ) values (
      p_student_id, null, p_practice_session_id, p_question_id, null, null,
      false, false, nullif((greatest(p_elapsed_milliseconds, 0) + 999) / 1000, 0),
      greatest(p_elapsed_milliseconds, 0), now(), p_was_timed, p_mode
    )
    on conflict (student_practice_session_id, question_id)
    do update set
      time_spent_milliseconds = coalesce(public.student_question_attempts.time_spent_milliseconds, 0)
        + greatest(excluded.time_spent_milliseconds, 0),
      time_spent_seconds = nullif((coalesce(public.student_question_attempts.time_spent_milliseconds, 0)
        + greatest(excluded.time_spent_milliseconds, 0) + 999) / 1000, 0),
      first_seen_at = coalesce(public.student_question_attempts.first_seen_at, excluded.first_seen_at),
      was_timed = excluded.was_timed,
      mode = excluded.mode;
  end if;
end;
$$;

revoke all on function public.increment_ucat_question_active_time(uuid, uuid, uuid, uuid, bigint, boolean, text)
  from public, anon, authenticated;
grant execute on function public.increment_ucat_question_active_time(uuid, uuid, uuid, uuid, bigint, boolean, text)
  to service_role;

create or replace function public.discard_ucat_exam_attempt(
  p_student_id uuid,
  p_attempt_kind text,
  p_attempt_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_changed integer := 0;
begin
  if p_attempt_kind = 'set' then
    update public.student_question_set_attempts
    set discarded_at = now(), current_segment_ends_at = null
    where id = p_attempt_id and student_id = p_student_id
      and student_ucat_mock_attempt_id is null and completed_at is null
      and discarded_at is null and expired_at is null;
    get diagnostics v_changed = row_count;
  elsif p_attempt_kind = 'mock' then
    update public.student_ucat_mock_attempts
    set discarded_at = now(), current_segment_ends_at = null
    where id = p_attempt_id and student_id = p_student_id
      and completed_at is null and discarded_at is null and expired_at is null;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.student_question_set_attempts
      set discarded_at = now(), current_segment_ends_at = null
      where student_ucat_mock_attempt_id = p_attempt_id
        and student_id = p_student_id and completed_at is null
        and discarded_at is null and expired_at is null;
    end if;
  elsif p_attempt_kind = 'practice' then
    update public.student_practice_sessions
    set discarded_at = now(), current_segment_ends_at = null,
      prefetched_stem_snapshot = null
    where id = p_attempt_id and student_id = p_student_id
      and completed_at is null and discarded_at is null and expired_at is null;
    get diagnostics v_changed = row_count;
  else
    raise exception 'Invalid attempt kind';
  end if;
  return v_changed > 0;
end;
$$;

revoke all on function public.discard_ucat_exam_attempt(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.discard_ucat_exam_attempt(uuid, text, uuid)
  to service_role;

create or replace function public.expire_stale_ucat_exam_attempts(p_student_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_changed integer := 0;
begin
  update public.student_question_set_attempts
  set expired_at = now(), current_segment_ends_at = null
  where student_id = p_student_id and student_ucat_mock_attempt_id is null
    and completed_at is null and discarded_at is null and expired_at is null
    and not was_timed
    and last_activity_at < now() - interval '7 days';
  get diagnostics v_changed = row_count;
  v_count := v_count + v_changed;
  update public.student_ucat_mock_attempts
  set expired_at = now(), current_segment_ends_at = null
  where student_id = p_student_id and completed_at is null
    and discarded_at is null and expired_at is null
    and not was_timed and last_activity_at < now() - interval '7 days';
  get diagnostics v_changed = row_count;
  v_count := v_count + v_changed;
  if v_changed > 0 then
    update public.student_question_set_attempts child
    set expired_at = now(), current_segment_ends_at = null
    from public.student_ucat_mock_attempts parent
    where parent.student_id = p_student_id
      and parent.expired_at is not null
      and parent.expired_at >= now() - interval '1 minute'
      and child.student_ucat_mock_attempt_id = parent.id
      and child.completed_at is null and child.discarded_at is null
      and child.expired_at is null;
  end if;

  update public.student_practice_sessions
  set expired_at = now(), current_segment_ends_at = null,
    prefetched_stem_snapshot = null
  where student_id = p_student_id and completed_at is null
    and discarded_at is null and expired_at is null
    and not was_timed and last_activity_at < now() - interval '7 days';
  get diagnostics v_changed = row_count;
  v_count := v_count + v_changed;

  insert into public.notifications (
    student_id, notification_type, app_scope, title, body, metadata,
    dedupe_key, priority
  )
  select p_student_id, 'ucat.exam_attempt.expired', 'ucat_web',
    'UCAT attempt expired',
    'An inactive UCAT attempt was closed after 7 days. Its saved answers were kept, but it was not scored.',
    jsonb_build_object('attempt_kind', expired.kind, 'attempt_id', expired.id),
    'ucat:exam-attempt-expired:' || expired.kind || ':' || expired.id,
    'normal'
  from (
    select id, 'set'::text as kind from public.student_question_set_attempts
    where student_id = p_student_id and student_ucat_mock_attempt_id is null
      and expired_at is not null
      and expired_at >= now() - interval '1 minute'
    union all
    select id, 'mock' from public.student_ucat_mock_attempts
    where student_id = p_student_id and expired_at is not null
      and expired_at >= now() - interval '1 minute'
    union all
    select id, 'practice' from public.student_practice_sessions
    where student_id = p_student_id and expired_at is not null
      and expired_at >= now() - interval '1 minute'
  ) expired
  on conflict (dedupe_key) do nothing;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_ucat_exam_attempts(uuid)
  from public, anon, authenticated;
grant execute on function public.expire_stale_ucat_exam_attempts(uuid)
  to service_role;
