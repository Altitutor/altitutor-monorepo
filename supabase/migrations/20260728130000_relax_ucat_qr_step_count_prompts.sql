-- QR questions may use as many purposeful steps as their reasoning requires.
-- This migration updates prompt configuration only and is deployed through CI/CD.

UPDATE public.ucat_ai_generation_prompt_layers layer
SET
  prompt_text = REPLACE(
    REPLACE(
      layer.prompt_text,
      'Ask for one or two efficient operations plus interpretation, not long algebra.',
      'Use however many purposeful calculation and interpretation steps the question naturally requires; do not impose a fixed number of steps.'
    ),
    'Questions should test row/column selection plus one or two operations such as totals, differences, ratios, percentages, averages, rankings, unit conversions, or cheapest/largest/smallest comparisons.',
    'Questions should test row/column selection with however many purposeful operations the reasoning requires, such as totals, differences, ratios, percentages, averages, rankings, unit conversions, or cheapest/largest/smallest comparisons.'
  ),
  prompt_version = layer.prompt_version + 1,
  updated_at = NOW()
FROM public.ucat_sections section
LEFT JOIN public.question_stem_categories category
  ON category.ucat_section_id = section.id
WHERE section.name = 'Quantitative Reasoning'
  AND (
    (layer.scope_type = 'section' AND layer.scope_id = section.id)
    OR (layer.scope_type = 'stem_category' AND layer.scope_id = category.id)
  )
  AND (
    layer.prompt_text LIKE '%one or two efficient operations%'
    OR layer.prompt_text LIKE '%one or two operations%'
  );

UPDATE public.ucat_ai_generation_prompt_layers layer
SET
  prompt_text = REPLACE(
    layer.prompt_text,
    'Each question should require identifying the relevant source and applying one additional operation.',
    'Each question should require identifying the relevant sources and applying however many purposeful operations the reasoning requires.'
  ),
  prompt_version = layer.prompt_version + 1,
  updated_at = NOW()
FROM public.question_stem_categories category
JOIN public.ucat_sections section
  ON section.id = category.ucat_section_id
WHERE layer.scope_type = 'stem_category'
  AND layer.scope_id = category.id
  AND section.name = 'Quantitative Reasoning'
  AND layer.prompt_text LIKE '%one additional operation%';
