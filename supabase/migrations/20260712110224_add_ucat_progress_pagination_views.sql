-- These views were added to the pagination migration after that migration had
-- already run on the hosted project. Keep them in a new migration so every
-- environment receives the same schema.

create or replace view public.vstudent_ucat_progress_attempt_history
with (security_invoker = false)
as
select
  'set'::text as source,
  a.id,
  us.id as section_id,
  us.name as section_name,
  a.question_set_id as resource_id,
  qs.name as resource_name,
  qs.is_student_generated,
  false as unlimited,
  a.attempted_at,
  a.completed_at,
  a.score_points,
  a.total_points,
  a.scaled_score,
  a.time_taken_seconds,
  a.set_time_limit_seconds as time_limit_seconds,
  a.student_set_speed,
  a.student_exam_speed,
  a.was_timed,
  null::integer as question_count,
  null::numeric as scaled_score_max
from public.student_question_set_attempts a
join public.question_sets qs on qs.id = a.question_set_id
left join public.ucat_sections us
  on us.section_number = nullif(qs.sections -> 0 ->> 'section_number', '')::integer
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null
  and a.student_ucat_mock_attempt_id is null
union all
select
  'practice'::text,
  a.id,
  a.ucat_section_id,
  us.name,
  a.ucat_section_id,
  to_jsonb(us.name),
  false,
  a.unlimited,
  a.started_at,
  a.completed_at,
  a.score_points,
  a.total_points,
  null::numeric,
  extract(epoch from (a.completed_at - a.started_at))::integer,
  null::integer,
  null::numeric,
  null::numeric,
  false,
  a.question_count,
  null::numeric
from public.student_practice_sessions a
join public.ucat_sections us on us.id = a.ucat_section_id
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null
union all
select
  'mock'::text,
  a.id,
  null::uuid,
  null::text,
  a.ucat_mock_id,
  to_jsonb(m.name),
  false,
  false,
  a.attempted_at,
  a.completed_at,
  a.score_points,
  a.total_points,
  a.scaled_score,
  a.time_taken,
  a.mock_time_limit_seconds,
  null::numeric,
  a.student_mock_speed,
  (a.mock_time_limit_seconds is not null and a.mock_time_limit_seconds > 0),
  null::integer,
  2700::numeric
from public.student_ucat_mock_attempts a
join public.ucat_mocks m on m.id = a.ucat_mock_id
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null;

grant select on public.vstudent_ucat_progress_attempt_history to authenticated;

create or replace view public.vstudent_ucat_section_set_progress
with (security_invoker = false)
as
select
  us.id as section_id,
  count(distinct a.question_set_id) filter (where not qs.is_student_generated)::integer as total_completed,
  count(distinct a.question_set_id) filter (where not qs.is_student_generated and not a.was_timed)::integer as untimed_completed,
  count(distinct a.question_set_id) filter (where not qs.is_student_generated and a.was_timed)::integer as timed_completed
from public.student_question_set_attempts a
join public.question_sets qs on qs.id = a.question_set_id
join public.ucat_sections us
  on us.section_number = nullif(qs.sections -> 0 ->> 'section_number', '')::integer
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null
group by us.id;

grant select on public.vstudent_ucat_section_set_progress to authenticated;

create or replace view public.vstudent_ucat_mock_progress_summary
with (security_invoker = false)
as
select
  count(*)::integer as attempt_count,
  round(avg(a.scaled_score))::integer as average_scaled_score
from public.student_ucat_mock_attempts a
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null
  and a.scaled_score is not null;

grant select on public.vstudent_ucat_mock_progress_summary to authenticated;

create or replace view public.vstudent_ucat_mock_section_progress
with (security_invoker = false)
as
select
  us.id as section_id,
  round(avg(a.scaled_score))::integer as average_scaled_score
from public.student_question_set_attempts a
join public.question_sets qs on qs.id = a.question_set_id
join public.ucat_sections us
  on us.section_number = nullif(qs.sections -> 0 ->> 'section_number', '')::integer
where a.student_id = public.current_student_id()
  and public.is_ucat_student()
  and a.completed_at is not null
  and a.student_ucat_mock_attempt_id is not null
  and a.scaled_score is not null
group by us.id;

grant select on public.vstudent_ucat_mock_section_progress to authenticated;

notify pgrst, 'reload schema';
