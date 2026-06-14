import { getSupabaseClient } from '@/shared/lib/supabase/client';

type SupabaseAny = ReturnType<typeof getSupabaseClient> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type UcatGenerationProvider = {
  id: string;
  name: string;
  provider_key: string;
  base_url: string;
  secret_env_var_name: string;
  default_headers: Record<string, unknown>;
  is_enabled: boolean;
};

export type UcatGenerationSettings = {
  id: string;
  max_candidates_per_stem: number;
  max_requested_stems_per_run: number;
  daily_token_budget: number | null;
  daily_cost_budget_cents: number | null;
  raw_logging_enabled: boolean;
};

export type UcatGenerationProfile = {
  id: string;
  name: string;
  provider_id: string;
  model: string;
  is_enabled: boolean;
  is_default: boolean;
  candidates_per_stem: number;
  temperature: number;
  max_completion_tokens: number;
  profile_version: number;
  base_system_prompt: string;
  planner_prompt: string;
  writer_prompt: string;
  critic_prompt: string;
  rewriter_prompt: string;
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
  profiles: UcatGenerationProfile[];
  promptLayers: UcatGenerationPromptLayer[];
  taxonomyOptions: UcatGenerationTaxonomyOption[];
};

const SETTINGS_ID = 'cc4e8af1-9eca-4e97-a637-f4b87a4ed850';

function client(): SupabaseAny {
  return getSupabaseClient() as SupabaseAny;
}

export const ucatGenerationSettingsApi = {
  async getBundle(): Promise<UcatGenerationSettingsBundle> {
    const supabase = client();
    const [settingsRes, providersRes, profilesRes, layersRes, sectionsRes, categoriesRes, tagsRes] =
      await Promise.all([
        supabase.from('ucat_ai_generation_settings').select('*').eq('id', SETTINGS_ID).maybeSingle(),
        supabase.from('ucat_ai_generation_providers').select('*').order('name'),
        supabase.from('ucat_ai_generation_profiles').select('*').order('is_default', { ascending: false }).order('name'),
        supabase.from('ucat_ai_generation_prompt_layers').select('*').order('scope_type').order('updated_at', { ascending: false }),
        supabase.from('ucat_sections').select('id,name').order('section_number'),
        supabase.from('question_stem_categories').select('id,name,ucat_section_id, ucat_sections(name)').order('name'),
        supabase.from('question_tags').select('id,name,ucat_section_id').order('name'),
      ]);

    for (const res of [settingsRes, providersRes, profilesRes, layersRes, sectionsRes, categoriesRes, tagsRes]) {
      if (res.error) throw res.error;
    }

    const settings = settingsRes.data as UcatGenerationSettings | null;
    if (!settings) throw new Error('No UCAT generation settings row found. Apply migrations first.');

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
      providers: (providersRes.data ?? []) as UcatGenerationProvider[],
      profiles: (profilesRes.data ?? []) as UcatGenerationProfile[],
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
    const { error } = await client()
      .from('ucat_ai_generation_providers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async updateProfile(id: string, updates: Partial<UcatGenerationProfile>): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_profiles')
      .update({
        ...updates,
        profile_version: updates.profile_version,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async createProfile(input: Omit<UcatGenerationProfile, 'id' | 'profile_version'>): Promise<void> {
    const { error } = await client()
      .from('ucat_ai_generation_profiles')
      .insert({
        ...input,
        profile_version: 1,
      });
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
};
