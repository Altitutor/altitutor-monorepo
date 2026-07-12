-- Indexes supporting current-student chronological history and best-attempt ranking.
create index if not exists idx_student_question_attempts_progress_best
  on public.student_question_attempts
  (student_id, question_id, score desc, attempted_at desc, id desc)
  where is_submitted = true;

create index if not exists idx_student_set_attempts_completed_history
  on public.student_question_set_attempts (student_id, completed_at desc, id desc)
  where completed_at is not null;

create index if not exists idx_student_mock_attempts_completed_history
  on public.student_ucat_mock_attempts (student_id, completed_at desc, id desc)
  where completed_at is not null;

create index if not exists idx_student_practice_sessions_completed_history
  on public.student_practice_sessions (student_id, completed_at desc, id desc)
  where completed_at is not null;

-- A compact daily source for graphs. Values are additive so the client can
-- correctly combine days into calendar weeks, months, or arbitrary ranges.
create view public.vstudent_ucat_progress_series_daily
with (security_invoker = false)
as
with student_context as (
  select s.id as student_id, s.timezone
  from public.students s
  where s.id = public.current_student_id()
    and public.is_ucat_student()
), set_days as (
  select
    'set'::text as source,
    us.id as section_id,
    (coalesce(a.completed_at, a.attempted_at) at time zone ctx.timezone)::date as activity_date,
    count(*)::integer as attempt_count,
    coalesce(sum(a.scaled_score), 0)::numeric as scaled_score_sum,
    count(a.scaled_score)::integer as scaled_score_count,
    coalesce(sum(a.score_points), 0)::numeric as score_points_sum,
    coalesce(sum(a.total_points), 0)::numeric as total_points_sum,
    coalesce(sum(a.time_taken_seconds), 0)::bigint as time_taken_seconds_sum,
    count(a.time_taken_seconds)::integer as time_taken_count,
    coalesce(sum(a.set_time_limit_seconds), 0)::bigint as time_limit_seconds_sum,
    coalesce(sum(a.student_exam_speed * 100), 0)::numeric as exam_speed_percent_sum,
    count(a.student_exam_speed)::integer as exam_speed_count
  from public.student_question_set_attempts a
  join student_context ctx on ctx.student_id = a.student_id
  join public.question_sets qs on qs.id = a.question_set_id
  left join public.ucat_sections us
    on us.section_number = nullif(qs.sections -> 0 ->> 'section_number', '')::integer
  where a.completed_at is not null
    and a.student_ucat_mock_attempt_id is null
  group by us.id, 3
), practice_days as (
  select
    'practice'::text as source,
    a.ucat_section_id as section_id,
    (coalesce(a.completed_at, a.started_at) at time zone ctx.timezone)::date as activity_date,
    count(*)::integer as attempt_count,
    0::numeric as scaled_score_sum,
    0::integer as scaled_score_count,
    coalesce(sum(a.score_points), 0)::numeric as score_points_sum,
    coalesce(sum(a.total_points), 0)::numeric as total_points_sum,
    coalesce(sum(extract(epoch from (a.completed_at - a.started_at))), 0)::bigint as time_taken_seconds_sum,
    count(a.completed_at)::integer as time_taken_count,
    0::bigint as time_limit_seconds_sum,
    0::numeric as exam_speed_percent_sum,
    0::integer as exam_speed_count
  from public.student_practice_sessions a
  join student_context ctx on ctx.student_id = a.student_id
  where a.completed_at is not null
  group by a.ucat_section_id, 3
), mock_days as (
  select
    'mock'::text as source,
    null::uuid as section_id,
    (coalesce(a.completed_at, a.attempted_at) at time zone ctx.timezone)::date as activity_date,
    count(*)::integer as attempt_count,
    coalesce(sum(a.scaled_score), 0)::numeric as scaled_score_sum,
    count(a.scaled_score)::integer as scaled_score_count,
    coalesce(sum(a.score_points), 0)::numeric as score_points_sum,
    coalesce(sum(a.total_points), 0)::numeric as total_points_sum,
    coalesce(sum(a.time_taken), 0)::bigint as time_taken_seconds_sum,
    count(a.time_taken)::integer as time_taken_count,
    coalesce(sum(a.mock_time_limit_seconds), 0)::bigint as time_limit_seconds_sum,
    coalesce(sum(a.student_mock_speed * 100), 0)::numeric as exam_speed_percent_sum,
    count(a.student_mock_speed)::integer as exam_speed_count
  from public.student_ucat_mock_attempts a
  join student_context ctx on ctx.student_id = a.student_id
  where a.completed_at is not null
  group by 3
)
select * from set_days
union all
select * from practice_days
union all
select * from mock_days;

grant select on public.vstudent_ucat_progress_series_daily to authenticated;

comment on view public.vstudent_ucat_progress_series_daily is
  'Timezone-correct additive daily UCAT graph metrics for the current student.';

-- Normalized evidence removes duplicate history queries and large question-set
-- ID filters from the score-projection endpoint.
create view public.vstudent_ucat_score_projection_evidence
with (security_invoker = false)
as
select
  case when a.student_ucat_mock_attempt_id is null then 'set' else 'mock' end::text as source,
  us.id as section_id,
  coalesce(a.completed_at, a.attempted_at) as completed_at,
  a.scaled_score,
  a.score_points,
  a.total_points,
  a.was_timed,
  a.student_exam_speed
from public.student_question_set_attempts a
join public.question_sets qs on qs.id = a.question_set_id
join public.ucat_sections us
  on us.section_number = nullif(qs.sections -> 0 ->> 'section_number', '')::integer
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null

union all

select
  'practice'::text as source,
  a.ucat_section_id as section_id,
  coalesce(a.completed_at, a.started_at) as completed_at,
  null::numeric as scaled_score,
  a.score_points,
  a.total_points,
  false as was_timed,
  null::numeric as student_exam_speed
from public.student_practice_sessions a
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null;

grant select on public.vstudent_ucat_score_projection_evidence to authenticated;

comment on view public.vstudent_ucat_score_projection_evidence is
  'Normalized current-student set, mock-section, and practice evidence for score projection.';
