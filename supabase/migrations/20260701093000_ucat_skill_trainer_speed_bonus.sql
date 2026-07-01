-- UCAT skill trainers: remove dead wrong-answer cooldown config and add speed bonus config.

DROP VIEW IF EXISTS public.vstudent_ucat_skill_trainers;
DROP VIEW IF EXISTS public.vtutor_ucat_skill_trainers;
DROP VIEW IF EXISTS public.vtutor_ucat_skill_trainer_config;

ALTER TABLE public.ucat_skill_trainer_config
  DROP COLUMN IF EXISTS wrong_cooldown_seconds,
  ADD COLUMN IF NOT EXISTS speed_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS speed_bonus_max_points NUMERIC NOT NULL DEFAULT 5 CHECK (speed_bonus_max_points >= 0),
  ADD COLUMN IF NOT EXISTS speed_bonus_window_seconds INTEGER NOT NULL DEFAULT 8 CHECK (speed_bonus_window_seconds > 0);

ALTER TABLE public.student_skill_trainer_attempts
  ADD COLUMN IF NOT EXISTS current_item_started_at TIMESTAMPTZ;

UPDATE public.student_skill_trainer_attempts
SET current_item_started_at = started_at
WHERE current_item_started_at IS NULL;

CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainers
WITH (security_invoker = false)
AS
SELECT
  t.*,
  s.name AS section_name,
  s.section_number,
  c.time_limit_seconds,
  c.points_correct,
  c.points_wrong,
  c.streak_enabled,
  c.speed_bonus_enabled,
  c.speed_bonus_max_points,
  c.speed_bonus_window_seconds,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_skill_trainer_items i
    WHERE i.skill_trainer_id = t.id
      AND i.deleted_at IS NULL
  ) AS item_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_skill_trainer_items i
    WHERE i.skill_trainer_id = t.id
      AND i.deleted_at IS NULL
      AND i.approval_status = 'approved'
      AND i.is_active = true
  ) AS approved_active_item_count
FROM public.ucat_skill_trainers t
JOIN public.ucat_sections s ON s.id = t.ucat_section_id
LEFT JOIN public.ucat_skill_trainer_config c ON c.skill_trainer_id = t.id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_skill_trainers TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_skill_trainer_config
WITH (security_invoker = false)
AS
SELECT c.*
FROM public.ucat_skill_trainer_config c
WHERE public.is_ucat_tutor() OR (SELECT public.is_adminstaff_active());

GRANT SELECT ON public.vtutor_ucat_skill_trainer_config TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_skill_trainers
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
  c.streak_enabled,
  c.speed_bonus_enabled,
  c.speed_bonus_max_points,
  c.speed_bonus_window_seconds,
  t.icon
FROM public.ucat_skill_trainers t
JOIN public.ucat_sections s ON s.id = t.ucat_section_id
JOIN public.ucat_skill_trainer_config c ON c.skill_trainer_id = t.id
WHERE public.is_ucat_online_student()
  AND t.is_enabled = true;

GRANT SELECT ON public.vstudent_ucat_skill_trainers TO authenticated;
