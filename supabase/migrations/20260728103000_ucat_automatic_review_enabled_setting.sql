-- Migration: ucat_automatic_review_enabled_setting
-- Why: let admins disable auto AI review on in-review stems while keeping manual review

ALTER TABLE public.ucat_ai_generation_settings
  ADD COLUMN IF NOT EXISTS automatic_review_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.ucat_ai_generation_settings.automatic_review_enabled IS
  'When false, stems moved to in_review or edited in review are not queued for AI review automatically. Manual tutor requests still work when the server review gate is enabled.';

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_settings
WITH (security_invoker = false) AS
SELECT row.*
FROM public.ucat_ai_generation_settings row
WHERE (SELECT public.is_ucat_tutor());
