UPDATE public.ucat_skill_trainers
SET sort_order = CASE key
  WHEN 'mental_maths' THEN 4
  WHEN 'calculator_maths' THEN 5
  WHEN 'numpad_speed' THEN 6
  ELSE sort_order
END
WHERE key IN ('mental_maths', 'calculator_maths', 'numpad_speed');

UPDATE public.ucat_skill_trainer_config c
SET points_wrong = 5
FROM public.ucat_skill_trainers t
WHERE c.skill_trainer_id = t.id
  AND t.key IN ('find_word', 'find_concept')
  AND c.points_wrong = 0;
