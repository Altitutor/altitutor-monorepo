-- Anonymous, first-completed-attempt cohorts for individual UCAT set and mock
-- reviews. These functions intentionally expose aggregates only and are
-- restricted to the service role; attempt ownership is checked by the API
-- route before either function is called.

create index if not exists idx_ucat_set_attempt_percentile_cohort
  on public.student_question_set_attempts (
    question_set_id,
    student_id,
    completed_at,
    id
  )
  include (scaled_score)
  where completed_at is not null and scaled_score is not null;

create index if not exists idx_ucat_mock_attempt_percentile_cohort
  on public.student_ucat_mock_attempts (
    ucat_mock_id,
    student_id,
    completed_at,
    id
  )
  include (scaled_score)
  where completed_at is not null and scaled_score is not null;

create or replace function public.get_ucat_set_attempt_percentile_cohort(
  p_attempt_id uuid
)
returns table (
  target_score numeric,
  cohort_size bigint,
  scores_below bigint,
  scores_equal bigint,
  bins jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with target as (
    select attempt.question_set_id, attempt.scaled_score
    from public.student_question_set_attempts as attempt
    where attempt.id = p_attempt_id
      and attempt.completed_at is not null
      and attempt.scaled_score is not null
  ),
  ranked_attempts as (
    select
      attempt.scaled_score,
      row_number() over (
        partition by attempt.student_id
        order by attempt.completed_at, attempt.id
      ) as completion_number
    from public.student_question_set_attempts as attempt
    inner join target
      on target.question_set_id = attempt.question_set_id
    where attempt.completed_at is not null
      and attempt.scaled_score is not null
  ),
  first_attempts as (
    select ranked_attempts.scaled_score
    from ranked_attempts
    where ranked_attempts.completion_number = 1
  ),
  cohort_stats as (
    select
      count(*) as cohort_size,
      count(*) filter (
        where first_attempts.scaled_score < target.scaled_score
      ) as scores_below,
      count(*) filter (
        where first_attempts.scaled_score = target.scaled_score
      ) as scores_equal
    from first_attempts
    cross join target
  ),
  score_bins as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'score', grouped_scores.scaled_score,
          'count', grouped_scores.score_count
        )
        order by grouped_scores.scaled_score
      ),
      '[]'::jsonb
    ) as bins
    from (
      select first_attempts.scaled_score, count(*) as score_count
      from first_attempts
      group by first_attempts.scaled_score
    ) as grouped_scores
  )
  select
    target.scaled_score as target_score,
    cohort_stats.cohort_size,
    cohort_stats.scores_below,
    cohort_stats.scores_equal,
    score_bins.bins
  from target
  cross join cohort_stats
  cross join score_bins;
$function$;

create or replace function public.get_ucat_mock_attempt_percentile_cohort(
  p_attempt_id uuid
)
returns table (
  target_score numeric,
  cohort_size bigint,
  scores_below bigint,
  scores_equal bigint,
  bins jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with target as (
    select attempt.ucat_mock_id, attempt.scaled_score
    from public.student_ucat_mock_attempts as attempt
    where attempt.id = p_attempt_id
      and attempt.completed_at is not null
      and attempt.scaled_score is not null
  ),
  ranked_attempts as (
    select
      attempt.scaled_score,
      row_number() over (
        partition by attempt.student_id
        order by attempt.completed_at, attempt.id
      ) as completion_number
    from public.student_ucat_mock_attempts as attempt
    inner join target
      on target.ucat_mock_id = attempt.ucat_mock_id
    where attempt.completed_at is not null
      and attempt.scaled_score is not null
  ),
  first_attempts as (
    select ranked_attempts.scaled_score
    from ranked_attempts
    where ranked_attempts.completion_number = 1
  ),
  cohort_stats as (
    select
      count(*) as cohort_size,
      count(*) filter (
        where first_attempts.scaled_score < target.scaled_score
      ) as scores_below,
      count(*) filter (
        where first_attempts.scaled_score = target.scaled_score
      ) as scores_equal
    from first_attempts
    cross join target
  ),
  score_bins as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'score', grouped_scores.scaled_score,
          'count', grouped_scores.score_count
        )
        order by grouped_scores.scaled_score
      ),
      '[]'::jsonb
    ) as bins
    from (
      select first_attempts.scaled_score, count(*) as score_count
      from first_attempts
      group by first_attempts.scaled_score
    ) as grouped_scores
  )
  select
    target.scaled_score as target_score,
    cohort_stats.cohort_size,
    cohort_stats.scores_below,
    cohort_stats.scores_equal,
    score_bins.bins
  from target
  cross join cohort_stats
  cross join score_bins;
$function$;

revoke all on function public.get_ucat_set_attempt_percentile_cohort(uuid)
  from public, anon, authenticated;
revoke all on function public.get_ucat_mock_attempt_percentile_cohort(uuid)
  from public, anon, authenticated;

grant execute on function public.get_ucat_set_attempt_percentile_cohort(uuid)
  to service_role;
grant execute on function public.get_ucat_mock_attempt_percentile_cohort(uuid)
  to service_role;
