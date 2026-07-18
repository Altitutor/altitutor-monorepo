-- Keep paragraph references in explanations without teaching the model to print
-- those labels inside the Verbal Reasoning passage itself.
UPDATE public.ucat_ai_generation_prompt_layers AS layer
SET
  prompt_text = RTRIM(layer.prompt_text) || E'\n\nPassage paragraphs must be unnumbered prose and begin directly with their content. Never prefix passage text with labels or headings such as "Paragraph 1", "Paragraph 2", or "Paragraph 3". Paragraph numbers are positional references used only in answer explanations.',
  prompt_version = layer.prompt_version + 1,
  updated_at = NOW()
FROM public.ucat_sections AS section
WHERE layer.scope_type = 'section'
  AND layer.scope_id = section.id
  AND section.name = 'Verbal Reasoning'
  AND layer.prompt_text NOT LIKE '%Passage paragraphs must be unnumbered prose%';
