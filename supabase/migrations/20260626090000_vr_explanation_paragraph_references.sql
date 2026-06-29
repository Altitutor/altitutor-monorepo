WITH verbal_reasoning_section AS (
  SELECT id
  FROM public.ucat_sections
  WHERE name = 'Verbal Reasoning'
  LIMIT 1
),
prompt_update AS (
  SELECT
    verbal_reasoning_section.id AS scope_id,
    $prompt$Official-style Verbal Reasoning uses a 2-6 paragraph passage followed by four questions. The passage should read like a compact factual article, historical/scientific commentary, cultural note, or balanced argument. It should include enough detail for inference, author attitude, purpose, exact wording, and not-given distinctions.

Questions must be answerable from the passage alone. Avoid outside knowledge and generic comprehension checks. Distractors should be attractive because they overstate, reverse, use the wrong scope, confuse cause and correlation, import unsupported information, or match only part of the passage.

Answer explanations must cite the relevant passage paragraph number whenever they quote, paraphrase, or rely on textual evidence, using labels such as "Paragraph 2" or "paragraph 4".$prompt$ AS prompt_text
  FROM verbal_reasoning_section
)
INSERT INTO public.ucat_ai_generation_prompt_layers (
  scope_type,
  scope_id,
  prompt_text,
  prompt_version,
  is_enabled
)
SELECT
  'section',
  prompt_update.scope_id,
  prompt_update.prompt_text,
  1,
  TRUE
FROM prompt_update
ON CONFLICT (scope_type, scope_id) DO UPDATE
SET
  prompt_text = EXCLUDED.prompt_text,
  prompt_version = CASE
    WHEN public.ucat_ai_generation_prompt_layers.prompt_text IS DISTINCT FROM EXCLUDED.prompt_text
    THEN public.ucat_ai_generation_prompt_layers.prompt_version + 1
    ELSE public.ucat_ai_generation_prompt_layers.prompt_version
  END,
  is_enabled = TRUE,
  updated_at = NOW();
