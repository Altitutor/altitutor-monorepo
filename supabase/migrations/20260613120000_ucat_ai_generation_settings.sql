-- UCAT AI generation settings, provider abstraction, and usage metadata.

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_key TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  secret_env_var_name TEXT NOT NULL,
  default_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_providers_enabled
  ON public.ucat_ai_generation_providers(is_enabled);

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_candidates_per_stem INTEGER NOT NULL DEFAULT 3 CHECK (max_candidates_per_stem BETWEEN 1 AND 5),
  max_requested_stems_per_run INTEGER NOT NULL DEFAULT 20 CHECK (max_requested_stems_per_run BETWEEN 1 AND 50),
  daily_token_budget INTEGER,
  daily_cost_budget_cents INTEGER,
  raw_logging_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.ucat_ai_generation_providers(id) ON DELETE RESTRICT,
  model TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  candidates_per_stem INTEGER NOT NULL DEFAULT 2 CHECK (candidates_per_stem BETWEEN 1 AND 5),
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.8 CHECK (temperature >= 0 AND temperature <= 2),
  max_completion_tokens INTEGER NOT NULL DEFAULT 6000 CHECK (max_completion_tokens > 0),
  profile_version INTEGER NOT NULL DEFAULT 1,
  base_system_prompt TEXT NOT NULL,
  planner_prompt TEXT NOT NULL,
  writer_prompt TEXT NOT NULL,
  critic_prompt TEXT NOT NULL,
  rewriter_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_ai_generation_profiles_single_default
  ON public.ucat_ai_generation_profiles(is_default)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_profiles_enabled
  ON public.ucat_ai_generation_profiles(is_enabled);

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_prompt_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('section', 'stem_category', 'question_tag')),
  scope_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id),
  UNIQUE(scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_prompt_layers_scope
  ON public.ucat_ai_generation_prompt_layers(scope_type, scope_id);

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.ucat_ai_generation_profiles(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.ucat_ai_generation_providers(id) ON DELETE SET NULL,
  model TEXT,
  operation TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_cents INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_usage_created_at
  ON public.ucat_ai_generation_usage(created_at);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_usage_operation
  ON public.ucat_ai_generation_usage(operation);

ALTER TABLE public.ucat_ai_generation_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_generation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_generation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_generation_prompt_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_generation_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_providers" ON public.ucat_ai_generation_providers;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_providers" ON public.ucat_ai_generation_providers
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_providers" ON public.ucat_ai_generation_providers;
CREATE POLICY "UCAT tutors read ucat_ai_generation_providers" ON public.ucat_ai_generation_providers
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_settings" ON public.ucat_ai_generation_settings;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_settings" ON public.ucat_ai_generation_settings
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_settings" ON public.ucat_ai_generation_settings;
CREATE POLICY "UCAT tutors read ucat_ai_generation_settings" ON public.ucat_ai_generation_settings
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_profiles" ON public.ucat_ai_generation_profiles;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_profiles" ON public.ucat_ai_generation_profiles
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_profiles" ON public.ucat_ai_generation_profiles;
CREATE POLICY "UCAT tutors read ucat_ai_generation_profiles" ON public.ucat_ai_generation_profiles
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_prompt_layers" ON public.ucat_ai_generation_prompt_layers;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_prompt_layers" ON public.ucat_ai_generation_prompt_layers
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_prompt_layers" ON public.ucat_ai_generation_prompt_layers;
CREATE POLICY "UCAT tutors read ucat_ai_generation_prompt_layers" ON public.ucat_ai_generation_prompt_layers
  FOR SELECT USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_usage" ON public.ucat_ai_generation_usage;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_usage" ON public.ucat_ai_generation_usage
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors insert ucat_ai_generation_usage" ON public.ucat_ai_generation_usage;
CREATE POLICY "UCAT tutors insert ucat_ai_generation_usage" ON public.ucat_ai_generation_usage
  FOR INSERT WITH CHECK ((SELECT public.is_ucat_tutor()));

DROP TRIGGER IF EXISTS update_ucat_ai_generation_providers_updated_at ON public.ucat_ai_generation_providers;
CREATE TRIGGER update_ucat_ai_generation_providers_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ucat_ai_generation_settings_updated_at ON public.ucat_ai_generation_settings;
CREATE TRIGGER update_ucat_ai_generation_settings_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ucat_ai_generation_profiles_updated_at ON public.ucat_ai_generation_profiles;
CREATE TRIGGER update_ucat_ai_generation_profiles_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ucat_ai_generation_prompt_layers_updated_at ON public.ucat_ai_generation_prompt_layers;
CREATE TRIGGER update_ucat_ai_generation_prompt_layers_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_prompt_layers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.ucat_ai_generation_providers (
  id,
  name,
  provider_key,
  base_url,
  secret_env_var_name,
  default_headers
)
VALUES
  (
    '4b7fa4e0-7be3-4f1c-8b62-7e5a92702f01',
    'OpenRouter',
    'openrouter',
    'https://openrouter.ai/api/v1',
    'OPENROUTER_API_KEY',
    '{"HTTP-Referer":"https://altitutor.com","X-Title":"Altitutor UCAT generation"}'::jsonb
  )
ON CONFLICT (provider_key) DO UPDATE
SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  secret_env_var_name = EXCLUDED.secret_env_var_name,
  default_headers = EXCLUDED.default_headers,
  is_enabled = true,
  updated_at = NOW();

INSERT INTO public.ucat_ai_generation_settings (
  id,
  max_candidates_per_stem,
  max_requested_stems_per_run,
  daily_token_budget,
  daily_cost_budget_cents
)
VALUES (
  'cc4e8af1-9eca-4e97-a637-f4b87a4ed850',
  3,
  20,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ucat_ai_generation_profiles (
  id,
  name,
  provider_id,
  model,
  is_default,
  candidates_per_stem,
  temperature,
  max_completion_tokens,
  base_system_prompt,
  planner_prompt,
  writer_prompt,
  critic_prompt,
  rewriter_prompt
)
VALUES (
  '12d1804c-306b-45f1-9aac-f3e1596955a0',
  'Default UCAT generation',
  '4b7fa4e0-7be3-4f1c-8b62-7e5a92702f01',
  'openai/gpt-4o-mini',
  true,
  2,
  0.8,
  6000,
  'Generate UCAT ANZ tutor-review drafts that are close to publishable. Return JSON only. Do not copy source examples; use them only for style calibration.',
  'Plan diverse UCAT generation candidates that vary scenario domain, question archetype, distractor type, difficulty, and time burden while respecting the generation brief.',
  'Write UCAT stems, questions, answer options, correct answers, and explanations from the generation plan. Use structured content blocks for paragraphs, tables, and deterministic visual specs.',
  'Independently solve and critique generated UCAT candidates for answer validity, explanation quality, UCAT fit, ambiguity, target fit, and source-example similarity.',
  'Rewrite only salvageable candidates to fix gate failures or high-value warnings while preserving the generation brief and UCAT section rules.'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  provider_id = EXCLUDED.provider_id,
  model = EXCLUDED.model,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();
