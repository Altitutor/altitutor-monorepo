-- Refine editable VR AI generation prompt layers so passages support UCAT-style scanning.

WITH prompt_updates AS (
  SELECT
    qsc.id AS scope_id,
    qsc.name,
    CASE qsc.name
      WHEN 'Reading Comprehension' THEN
        'Generate Verbal Reasoning reading comprehension passages with exactly four questions and four options per question. Passages should feel like concise article excerpts with a slightly higher density of scan-friendly anchors: named entities, places, organisations, dates, years, quantities, percentages, study names, species names, quoted terms, or distinctive proper nouns. Use these anchors naturally rather than as a list. The four questions should test a realistic mix of reading skills: include at least two detail or local-inference questions that can be answered efficiently by scanning for a number, proper noun, date, quoted term, or distinctive phrase and then reading nearby context; use at most one broad whole-passage question such as main purpose, author attitude, or best overall support unless the requested time burden is high. Avoid making all four questions require rereading the whole passage.'
      WHEN 'True, False, Can''t Tell' THEN
        'Generate Verbal Reasoning True/False/Can''t Tell passages with exactly four questions. Each question must use the exact options True, False, and Can''t tell, and the explanation must distinguish contradicted, supported, and not-given information. Passages should feel like concise article excerpts with a slightly higher density of scan-friendly anchors: named entities, places, organisations, dates, years, quantities, percentages, study names, species names, quoted terms, or distinctive proper nouns. At least two statements should be efficiently answerable by scanning for one of those anchors and checking nearby context; avoid making all four statements broad whole-passage judgements.'
    END AS prompt_text
  FROM public.question_stem_categories qsc
  WHERE qsc.name IN ('Reading Comprehension', 'True, False, Can''t Tell')
)
INSERT INTO public.ucat_ai_generation_prompt_layers (
  scope_type,
  scope_id,
  prompt_text,
  prompt_version,
  is_enabled
)
SELECT
  'stem_category',
  scope_id,
  prompt_text,
  1,
  true
FROM prompt_updates
ON CONFLICT (scope_type, scope_id)
DO UPDATE SET
  prompt_text = EXCLUDED.prompt_text,
  prompt_version = public.ucat_ai_generation_prompt_layers.prompt_version + 1,
  is_enabled = true,
  updated_at = NOW();
