-- Aggregate the current student's best submitted attempt per question in
-- Postgres so progress pages do not load the complete attempt history.
create view public.vstudent_ucat_my_question_progress
with (security_invoker = true)
as
with ranked_attempts as (
  select
    attempt.question_id,
    attempt.question_stem_id,
    attempt.question_type,
    attempt.ucat_section_id,
    attempt.question_stem_category_id,
    attempt.score,
    row_number() over (
      partition by attempt.question_id
      order by attempt.score desc nulls last, attempt.attempted_at desc, attempt.id desc
    ) as question_rank
  from public.vstudent_ucat_my_question_attempts attempt
  where attempt.is_submitted = true
), best_attempts as (
  select
    ranked.question_id,
    ranked.question_stem_id,
    ranked.question_type,
    ranked.ucat_section_id,
    ranked.question_stem_category_id,
    ranked.score,
    row_number() over (
      partition by ranked.ucat_section_id, ranked.question_stem_id
      order by ranked.question_id
    ) as stem_question_rank
  from ranked_attempts ranked
  where ranked.question_rank = 1
)
select
  best.ucat_section_id as section_id,
  best.question_stem_category_id as category_id,
  coalesce(sum(best.score), 0)::integer as correct_score,
  sum(
    case
      when best.question_type = 'syllogism'
        then case when best.stem_question_rank = 1 then 2 else 0 end
      else 1
    end
  )::integer as max_score
from best_attempts best
where best.ucat_section_id is not null
group by best.ucat_section_id, best.question_stem_category_id;

grant select on public.vstudent_ucat_my_question_progress to authenticated;
