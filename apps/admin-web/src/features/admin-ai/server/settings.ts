import 'server-only';
import { z } from 'zod';
import { createClient } from '@/shared/lib/supabase/server-ssr';

type AdminClient = Awaited<ReturnType<typeof createClient>>;

export async function getAdminAiClient() {
  const client = await createClient();
  const [claims, active] = await Promise.all([
    client.auth.getClaims(),
    client.rpc('is_adminstaff_active'),
  ]);
  return claims.data?.claims.sub && !claims.data.claims.client_id &&
    !active.error && active.data === true ? client : null;
}

export const chatSettingsSchema = z.object({
  model_profile_id: z.uuid().nullable(),
  system_prompt: z.string().trim().min(1).max(8000),
});

export async function getChatSettings(client: AdminClient) {
  const { data, error } = await client
    .from('admin_ai_chat_settings')
    .select('model_profile_id, system_prompt')
    .eq('id', true)
    .single();
  if (error) throw error;
  return data;
}

export async function getChatProfiles(client: AdminClient) {
  const { data, error } = await client
    .from('ucat_ai_generation_model_profiles')
    .select('id, name, model, temperature, max_completion_tokens, provider:ucat_ai_generation_providers!inner(name, base_url, provider_kind, is_enabled, secret_env_var_name)')
    .eq('is_enabled', true)
    .eq('provider.is_enabled', true)
    .order('name');
  if (error) throw error;
  return data;
}

type ChatProvider = Awaited<ReturnType<typeof getChatProfiles>>[number]['provider'];

export function getChatProviderKind(provider: ChatProvider) {
  if (provider.provider_kind !== 'chat_completions') return null;
  const baseUrl = provider.base_url.replace(/\/+$/, '');
  if (baseUrl === 'https://api.openai.com/v1' && provider.secret_env_var_name === 'OPENAI_API_KEY') {
    return 'openai';
  }
  if (baseUrl === 'https://openrouter.ai/api/v1' && provider.secret_env_var_name === 'OPENROUTER_API_KEY') {
    return 'openrouter';
  }
  return null;
}

export function getChatApiKey(kind: ReturnType<typeof getChatProviderKind>) {
  if (kind === 'openai') return process.env.ADMIN_AI_OPENAI_API_KEY;
  if (kind === 'openrouter') return process.env.ADMIN_AI_OPENROUTER_API_KEY;
}
