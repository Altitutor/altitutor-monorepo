import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Json } from '@altitutor/shared';

type SupabaseAny = ReturnType<typeof getSupabaseClient> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type UcatGenerationProvider = {
  id: string;
  name: string;
  provider_key: string;
  provider_kind: 'chat_completions' | 'codex_oauth';
  base_url: string;
  secret_env_var_name: string;
  default_headers: Json;
  is_enabled: boolean;
};

export type UcatGenerationOAuthAccount = {
  id: string;
  provider_id: string;
  label: string;
  account_id: string;
  expires_at: string | null;
  status: 'connected' | 'refresh_failed' | 'revoked';
  last_error: string | null;
  updated_at: string;
};

export type UcatGenerationSettings = {
  id: string;
  max_requested_stems_per_run: number;
  daily_token_budget: number | null;
  daily_cost_budget_cents: number | null;
  raw_logging_enabled: boolean;
  automatic_review_blind_solver_model_profile_id: string | null;
  automatic_review_assessment_model_profile_id: string | null;
  automatic_review_use_solver_for_assessment: boolean;
};

export type UcatGenerationSystemPrompts = {
  id: string;
  base_system_prompt: string;
  planner_prompt: string;
  writer_prompt: string;
  critic_prompt: string;
  rewriter_prompt: string;
  prompt_version: number;
};

export type UcatGenerationModelProfile = {
  id: string;
  name: string;
  provider_id: string;
  model: string;
  is_enabled: boolean;
  is_default: boolean;
  temperature: number;
  max_completion_tokens: number;
};

export type UcatGenerationPromptLayer = {
  id: string;
  scope_type: 'section' | 'stem_category' | 'question_tag';
  scope_id: string;
  prompt_text: string;
  prompt_version: number;
  is_enabled: boolean;
};

export type UcatGenerationTaxonomyOption = {
  id: string;
  name: string;
  scope_type: UcatGenerationPromptLayer['scope_type'];
  section_name?: string | null;
};

export type UcatGenerationSettingsBundle = {
  settings: UcatGenerationSettings;
  providers: UcatGenerationProvider[];
  oauthAccounts: UcatGenerationOAuthAccount[];
  systemPrompts: UcatGenerationSystemPrompts;
  modelProfiles: UcatGenerationModelProfile[];
  promptLayers: UcatGenerationPromptLayer[];
  taxonomyOptions: UcatGenerationTaxonomyOption[];
};

const SETTINGS_ID = 'cc4e8af1-9eca-4e97-a637-f4b87a4ed850';
const SYSTEM_PROMPTS_ID = 'f2dd1f3c-bf71-46f0-b67c-637226fda8b4';

function client(): SupabaseAny {
  return getSupabaseClient() as SupabaseAny;
}

export const ucatGenerationSettingsApi = {
  async getBundle(): Promise<UcatGenerationSettingsBundle> {
    const supabase = client();
    const [settingsRes, providersRes, oauthAccountsFetch, systemPromptsRes, modelProfilesRes, layersRes, sectionsRes, categoriesRes, tagsRes] =
      await Promise.all([
        supabase.from('ucat_ai_generation_settings').select('*').eq('id', SETTINGS_ID).maybeSingle(),
        supabase.from('ucat_ai_generation_providers').select('*').order('name'),
        fetch('/api/ucat-generation/codex-oauth/accounts', { cache: 'no-store' }),
        supabase.from('ucat_ai_generation_system_prompts').select('*').eq('id', SYSTEM_PROMPTS_ID).maybeSingle(),
        supabase.from('ucat_ai_generation_model_profiles').select('*').order('is_default', { ascending: false }).order('name'),
        supabase.from('ucat_ai_generation_prompt_layers').select('*').order('scope_type').order('updated_at', { ascending: false }),
        supabase.from('ucat_sections').select('id,name').order('section_number'),
        supabase.from('question_stem_categories').select('id,name,ucat_section_id, ucat_sections(name)').order('name'),
        supabase.from('question_tags').select('id,name,ucat_section_id').order('name'),
      ]);

    for (const res of [settingsRes, providersRes, systemPromptsRes, modelProfilesRes, layersRes, sectionsRes, categoriesRes, tagsRes]) {
      if (res.error) throw res.error;
    }
    if (!oauthAccountsFetch.ok) {
      const message = await oauthAccountsFetch.text();
      throw new Error(message || 'Failed to load Codex OAuth accounts');
    }
    const oauthAccountsJson = await oauthAccountsFetch.json() as { accounts?: UcatGenerationOAuthAccount[] };

    const settings = settingsRes.data as UcatGenerationSettings | null;
    if (!settings) throw new Error('No UCAT generation settings row found. Apply migrations first.');
    const systemPrompts = systemPromptsRes.data as UcatGenerationSystemPrompts | null;
    if (!systemPrompts) throw new Error('No UCAT generation system prompts row found. Apply migrations first.');

    const sections = ((sectionsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((section) => ({
      id: section.id,
      name: section.name ?? 'Untitled section',
      scope_type: 'section' as const,
    }));
    const categories = ((categoriesRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      ucat_sections?: { name?: string | null } | null;
    }>).map((category) => ({
      id: category.id,
      name: category.name ?? 'Untitled category',
      section_name: category.ucat_sections?.name ?? null,
      scope_type: 'stem_category' as const,
    }));
    const tags = ((tagsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((tag) => ({
      id: tag.id,
      name: tag.name ?? 'Untitled tag',
      scope_type: 'question_tag' as const,
    }));

    return {
      settings,
      providers: ((providersRes.data ?? []) as unknown as UcatGenerationProvider[]).map((provider) => ({
        ...provider,
        provider_kind: provider.provider_kind ?? 'chat_completions',
      })),
      oauthAccounts: oauthAccountsJson.accounts ?? [],
      systemPrompts,
      modelProfiles: (modelProfilesRes.data ?? []) as UcatGenerationModelProfile[],
      promptLayers: (layersRes.data ?? []) as UcatGenerationPromptLayer[],
      taxonomyOptions: [...sections, ...categories, ...tags],
    };
  },

  async updateSettings(updates: Partial<UcatGenerationSettings>): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', SETTINGS_ID);
    if (error) throw error;
  },

  async updateProvider(id: string, updates: Partial<UcatGenerationProvider>): Promise<void> {
    const payload = {
      ...updates,
      default_headers: updates.default_headers,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client()
      .from('ucat_ai_generation_providers')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },

  async createProvider(input: {
    name: string;
    provider_key: string;
    provider_kind: UcatGenerationProvider['provider_kind'];
    base_url: string;
    secret_env_var_name: string;
    default_headers?: Json;
    is_enabled?: boolean;
  }): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_providers')
      .insert({
        name: input.name,
        provider_key: input.provider_key,
        provider_kind: input.provider_kind,
        base_url: input.base_url,
        secret_env_var_name: input.secret_env_var_name,
        default_headers: input.default_headers ?? {},
        is_enabled: input.is_enabled ?? true,
      });
    if (error) throw error;
  },

  async updateSystemPrompts(updates: Partial<UcatGenerationSystemPrompts>): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_system_prompts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', SYSTEM_PROMPTS_ID);
    if (error) throw error;
  },

  async updateModelProfile(id: string, updates: Partial<UcatGenerationModelProfile>): Promise<void> {
    if (updates.is_default) {
      const { error: clearDefaultError } = await client()
        .from('ucat_ai_generation_model_profiles')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .neq('id', id);
      if (clearDefaultError) throw clearDefaultError;
    }
    const { error } = await client()
      .from('ucat_ai_generation_model_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async createModelProfile(input: Omit<UcatGenerationModelProfile, 'id'>): Promise<void> {
    if (input.is_default) {
      const { error: clearDefaultError } = await client()
        .from('ucat_ai_generation_model_profiles')
        .update({ is_default: false, updated_at: new Date().toISOString() });
      if (clearDefaultError) throw clearDefaultError;
    }
    const { error } = await client()
      .from('ucat_ai_generation_model_profiles')
      .insert(input);
    if (error) throw error;
  },

  async deleteModelProfile(id: string): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_model_profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async upsertPromptLayer(input: {
    id?: string;
    scope_type: UcatGenerationPromptLayer['scope_type'];
    scope_id: string;
    prompt_text: string;
    prompt_version?: number;
    is_enabled?: boolean;
  }): Promise<void> {
    const payload = {
      ...input,
      prompt_version: input.prompt_version ?? 1,
      is_enabled: input.is_enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client()
      .from('ucat_ai_generation_prompt_layers')
      .upsert(payload, { onConflict: 'scope_type,scope_id' });
    if (error) throw error;
  },

  async updatePromptLayer(id: string, updates: Partial<Pick<UcatGenerationPromptLayer, 'is_enabled' | 'prompt_text' | 'prompt_version'>>): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_prompt_layers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
