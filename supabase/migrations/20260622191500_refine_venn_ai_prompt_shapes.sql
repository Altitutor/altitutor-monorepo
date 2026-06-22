-- Align the editable DM Venn prompt with the shape-based deterministic renderer.

WITH category_prompt AS (
  SELECT
    'Venn Diagrams'::text AS category_name,
    $prompt$Generate Decision Making Venn/set items using deterministic shape-based visuals, not the legacy coloured three-overlapping-circle template.

Use official-style set diagrams when appropriate: two-set or three-set diagrams, nested ellipses, rectangles with circles, triangles, pentagons, hexagons, diamonds, mixed overlapping shapes, or answer options that are diagrams. Region values must be sufficient to solve the question and should be placed inside the relevant regions.

Use visualType "set_diagram" or shape-based "venn_diagram" with spec.shapes and spec.labels. Keep diagrams monochrome or very lightly filled, with a separate legend for set names where labels would clutter the overlaps. If the question asks which diagram represents a scenario, put a visual block in each answer option.$prompt$ AS prompt_text
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
  category.id,
  category_prompt.prompt_text,
  1,
  true
FROM category_prompt
JOIN public.question_stem_categories category ON category.name = category_prompt.category_name
ON CONFLICT (scope_type, scope_id) DO UPDATE
SET
  prompt_text = EXCLUDED.prompt_text,
  prompt_version = CASE
    WHEN public.ucat_ai_generation_prompt_layers.prompt_text IS DISTINCT FROM EXCLUDED.prompt_text
    THEN public.ucat_ai_generation_prompt_layers.prompt_version + 1
    ELSE public.ucat_ai_generation_prompt_layers.prompt_version
  END,
  is_enabled = true,
  updated_at = NOW();
