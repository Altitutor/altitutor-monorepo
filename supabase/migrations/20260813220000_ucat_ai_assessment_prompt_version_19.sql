-- Keep this integer in sync with AI_ASSESSMENT_PROMPT_VERSION in
-- apps/tutor-web/src/features/ucat/questions/lib/ai-assessment/schema.ts.

CREATE OR REPLACE FUNCTION public.ucat_current_ai_assessment_prompt_version()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 19;
$$;

COMMENT ON FUNCTION public.ucat_current_ai_assessment_prompt_version() IS
  'Current tutor-web AI assessment prompt version. Must match AI_ASSESSMENT_PROMPT_VERSION.';
