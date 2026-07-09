-- Include Situational Judgement in score projection settings. SJT is still
-- excluded from total mock score elsewhere, but section-level prediction can
-- use the same evidence-weighted model.

INSERT INTO public.ucat_score_projection_settings (
  section_id,
  realistic_learning_rate,
  optimistic_learning_rate,
  pessimistic_learning_rate,
  realistic_ceiling_uplift,
  optimistic_ceiling_uplift,
  pessimistic_ceiling_uplift
)
SELECT
  s.id,
  0.005,
  0.008,
  0.003,
  100,
  150,
  60
FROM public.ucat_sections s
WHERE s.section_number = 4
ON CONFLICT (section_id) DO NOTHING;
