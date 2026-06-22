-- Decouple UCAT AI model parameters from prompt configuration.
-- Generation is not live, so replace the combined profile table rather than preserve its shape.

ALTER TABLE public.ucat_ai_generation_usage
  DROP COLUMN IF EXISTS profile_id;

DROP TABLE IF EXISTS public.ucat_ai_generation_profiles;

ALTER TABLE public.ucat_ai_generation_settings
  DROP COLUMN IF EXISTS max_candidates_per_stem;

CREATE TABLE public.ucat_ai_generation_system_prompts (
  id UUID PRIMARY KEY,
  base_system_prompt TEXT NOT NULL,
  planner_prompt TEXT NOT NULL,
  writer_prompt TEXT NOT NULL,
  critic_prompt TEXT NOT NULL,
  rewriter_prompt TEXT NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE TABLE public.ucat_ai_generation_model_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.ucat_ai_generation_providers(id) ON DELETE RESTRICT,
  model TEXT NOT NULL,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.8 CHECK (temperature >= 0 AND temperature <= 2),
  max_completion_tokens INTEGER NOT NULL DEFAULT 6000 CHECK (max_completion_tokens > 0),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE UNIQUE INDEX idx_ucat_ai_generation_model_profiles_single_default
  ON public.ucat_ai_generation_model_profiles(is_default)
  WHERE is_default = true;

CREATE INDEX idx_ucat_ai_generation_model_profiles_enabled
  ON public.ucat_ai_generation_model_profiles(is_enabled);

ALTER TABLE public.ucat_ai_generation_usage
  ADD COLUMN model_profile_id UUID REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ucat_ai_generation_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_generation_model_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_system_prompts"
  ON public.ucat_ai_generation_system_prompts
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "UCAT tutors read ucat_ai_generation_system_prompts"
  ON public.ucat_ai_generation_system_prompts
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_model_profiles"
  ON public.ucat_ai_generation_model_profiles
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "UCAT tutors read ucat_ai_generation_model_profiles"
  ON public.ucat_ai_generation_model_profiles
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

CREATE TRIGGER update_ucat_ai_generation_system_prompts_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_system_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_ucat_ai_generation_model_profiles_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_model_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.ucat_ai_generation_system_prompts (
  id,
  base_system_prompt,
  planner_prompt,
  writer_prompt,
  critic_prompt,
  rewriter_prompt,
  prompt_version
)
VALUES (
  'f2dd1f3c-bf71-46f0-b67c-637226fda8b4',
  $system$Generate UCAT ANZ tutor-review drafts that should need minimal editing before approval. Return JSON only.

Calibrate to official UCAT practice style: concise stems, ordinary real-world contexts, precise wording, plausible distractors, strict answer formats, and no teaching-style scaffolding.

Do not copy source examples, distinctive premises, data relationships, names, or near-exact wording. Use examples only to calibrate style, length, difficulty, and answer format.

Every answer must be independently defensible from the supplied stem. Explanations must be student-facing, concise, and must explain the decisive reasoning rather than merely restating the answer.$system$,
  $planner$Plan more candidates than will be surfaced, then make them genuinely different.

For every planned candidate specify the exact UCAT section and category, scenario or data domain, reasoning operation, intended difficulty and time burden, distractor strategy, and official-style feature being imitated without copying content.

Use mixed difficulty to create a realistic spread. Prefer clean, testable constraints over decorative complexity.$planner$,
  $writer$Write near-publishable UCAT candidates from the generation brief.

Respect the output schema exactly. Make stems compact, information-dense, and self-contained. Use tables or deterministic visual specs only when the data structure is part of the reasoning.

For every multiple-choice question, produce one unambiguously correct answer and plausible distractors representing common candidate errors. For every syllogism option, mark Yes or No through isAnswer and explain the logical consequence.

For every question-level explanation, include the decisive calculation, textual evidence, logical constraint, or professional judgement. Also explain why the strongest distractor fails.$writer$,
  $critic$Act as a strict UCAT ANZ moderator.

Independently solve each candidate before judging it. Block objective answer errors, unsupported conclusions, copied or near-copied source material, wrong option counts, wrong category format, ambiguous objective items, impossible calculations, and explanations that do not support the keyed answer.

Warn rather than block for mild style issues, slightly thin distractors, small difficulty mismatches, or defensible Situational Judgement and Verbal Reasoning nuance.$critic$,
  $rewriter$Rewrite only salvageable candidates.

Fix the listed issues while preserving the selected section, category, answer format, and intended difficulty. If an issue requires changing the premise, rebuild the smallest possible part of the stem and all affected answers and explanations.

Do not add long teaching text. Return exactly one candidate in the required JSON shape.$rewriter$,
  1
);

INSERT INTO public.ucat_ai_generation_model_profiles (
  id,
  name,
  provider_id,
  model,
  temperature,
  max_completion_tokens,
  is_enabled,
  is_default
)
VALUES (
  '12d1804c-306b-45f1-9aac-f3e1596955a0',
  'Default model',
  '4b7fa4e0-7be3-4f1c-8b62-7e5a92702f01',
  'openai/gpt-4o-mini',
  0.8,
  6000,
  true,
  true
);
