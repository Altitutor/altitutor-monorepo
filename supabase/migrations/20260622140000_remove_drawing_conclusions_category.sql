-- Remove the redundant Decision Making "Drawing Conclusions" category.
-- Syllogisms covers the same question type; reassign any existing stems first.

DO $$
DECLARE
  v_drawing_conclusions_id UUID := '2367bab9-c94a-4996-9511-064eaef1588d';
  v_syllogisms_id UUID := 'b35d193a-d054-4ac2-8ae3-669ac1ff79bc';
BEGIN
  UPDATE public.question_stems
  SET
    question_stem_category_id = v_syllogisms_id,
    updated_at = NOW()
  WHERE question_stem_category_id = v_drawing_conclusions_id;

  DELETE FROM public.ucat_ai_generation_prompt_layers
  WHERE scope_type = 'stem_category'
    AND scope_id = v_drawing_conclusions_id;

  DELETE FROM public.question_stem_categories
  WHERE id = v_drawing_conclusions_id;
END $$;
