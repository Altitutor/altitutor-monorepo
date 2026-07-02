-- UCAT AI generation: ChatGPT/Codex OAuth provider support.
-- OAuth tokens are stored encrypted by application code. The database only
-- stores ciphertext and non-secret account metadata.

ALTER TABLE public.ucat_ai_generation_providers
  ADD COLUMN IF NOT EXISTS provider_kind TEXT NOT NULL DEFAULT 'chat_completions';

ALTER TABLE public.ucat_ai_generation_providers
  DROP CONSTRAINT IF EXISTS ucat_ai_generation_providers_provider_kind_check;

ALTER TABLE public.ucat_ai_generation_providers
  ADD CONSTRAINT ucat_ai_generation_providers_provider_kind_check
  CHECK (provider_kind IN ('chat_completions', 'codex_oauth'));

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_providers_kind
  ON public.ucat_ai_generation_providers(provider_kind);

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ucat_ai_generation_providers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token_ciphertext JSONB NOT NULL,
  refresh_token_ciphertext JSONB,
  id_token_ciphertext JSONB,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'refresh_failed', 'revoked')),
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id),
  UNIQUE(provider_id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_oauth_accounts_provider
  ON public.ucat_ai_generation_oauth_accounts(provider_id);

ALTER TABLE public.ucat_ai_generation_oauth_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_oauth_accounts"
  ON public.ucat_ai_generation_oauth_accounts;

DROP TRIGGER IF EXISTS update_ucat_ai_generation_oauth_accounts_updated_at
  ON public.ucat_ai_generation_oauth_accounts;

CREATE TRIGGER update_ucat_ai_generation_oauth_accounts_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON COLUMN public.ucat_ai_generation_providers.provider_kind IS
  'Transport used by the UCAT AI client: OpenAI-compatible chat completions or unofficial ChatGPT/Codex OAuth responses.';

COMMENT ON TABLE public.ucat_ai_generation_oauth_accounts IS
  'Server-only encrypted OAuth token storage for UCAT AI generation providers that use ChatGPT/Codex subscription auth. No authenticated RLS policy is created; application API routes must use service-role access and return sanitized status only.';
