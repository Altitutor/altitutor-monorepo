-- Skill trainer icons + enable streak scoring on all trainers

ALTER TABLE public.ucat_skill_trainers
  ADD COLUMN IF NOT EXISTS icon TEXT;

UPDATE public.ucat_skill_trainers
SET icon = CASE key
  WHEN 'find_word' THEN 'Search'
  WHEN 'find_concept' THEN 'ScanEye'
  WHEN 'quick_syllogism' THEN 'GitBranch'
  WHEN 'mental_maths' THEN 'Brain'
  WHEN 'numpad_speed' THEN 'Calculator'
  WHEN 'calculator_maths' THEN 'Sigma'
  ELSE 'Target'
END
WHERE icon IS NULL;

UPDATE public.ucat_skill_trainer_config
SET streak_enabled = true;

-- icon appended at end: CREATE OR REPLACE cannot insert columns mid-view
DROP VIEW IF EXISTS public.vstudent_ucat_skill_trainers;

CREATE VIEW public.vstudent_ucat_skill_trainers
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.key,
  t.name,
  t.description,
  t.ucat_section_id,
  t.sort_order,
  s.name AS section_name,
  s.section_number,
  c.time_limit_seconds,
  c.wrong_cooldown_seconds,
  c.streak_enabled,
  t.icon
FROM public.ucat_skill_trainers t
JOIN public.ucat_sections s ON s.id = t.ucat_section_id
JOIN public.ucat_skill_trainer_config c ON c.skill_trainer_id = t.id
WHERE public.is_ucat_online_student()
  AND t.is_enabled = true;

GRANT SELECT ON public.vstudent_ucat_skill_trainers TO authenticated;
