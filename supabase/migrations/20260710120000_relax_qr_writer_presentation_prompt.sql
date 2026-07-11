-- Let the writer choose an appropriate data presentation instead of making
-- tables the lowest-risk generic representation for every QR source.

WITH prompt_value AS (
  SELECT $writer$Write near-publishable UCAT candidates from the generation brief.

Respect the output schema exactly. Make stems compact, information-dense, and self-contained. Choose the data presentation that is most natural for the new source and reasoning. When a table or visual is used, encode its examinable data as structured content.

For every multiple-choice question, produce one unambiguously correct answer and plausible distractors representing common candidate errors. For every syllogism option, mark Yes or No through isAnswer and explain the logical consequence.

For every question-level explanation, include the decisive calculation, textual evidence, logical constraint, or professional judgement. Also explain why the strongest distractor fails.$writer$ AS writer_prompt
)
UPDATE public.ucat_ai_generation_system_prompts prompts
SET
  writer_prompt = prompt_value.writer_prompt,
  prompt_version = prompts.prompt_version + 1,
  updated_at = NOW()
FROM prompt_value
WHERE prompts.id = 'f2dd1f3c-bf71-46f0-b67c-637226fda8b4'
  AND prompts.writer_prompt IS DISTINCT FROM prompt_value.writer_prompt;
