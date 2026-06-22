'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchableSelect,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@altitutor/ui';
import {
  ucatGenerationSettingsApi,
  type UcatGenerationModelProfile,
  type UcatGenerationPromptLayer,
  type UcatGenerationProvider,
  type UcatGenerationSettings,
  type UcatGenerationSettingsBundle,
  type UcatGenerationSystemPrompts,
} from '@/features/ucat-generation-settings/api/ucat-generation-settings';

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: UcatGenerationSettingsBundle; error: null }
  | { status: 'error'; data: null; error: string };

type ScopeOption = {
  id: UcatGenerationPromptLayer['scope_type'];
  label: string;
};

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: 'section', label: 'Section' },
  { id: 'stem_category', label: 'Stem category' },
  { id: 'question_tag', label: 'Question tag' },
];

function parseNullableInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerName(providers: UcatGenerationProvider[], providerId: string): string {
  return providers.find((provider) => provider.id === providerId)?.name ?? 'Unknown provider';
}

function SettingsForm({ settings, onSaved }: { settings: UcatGenerationSettings; onSaved: () => void }) {
  const [maxStems, setMaxStems] = useState(String(settings.max_requested_stems_per_run));
  const [dailyTokens, setDailyTokens] = useState(settings.daily_token_budget == null ? '' : String(settings.daily_token_budget));
  const [dailyCost, setDailyCost] = useState(
    settings.daily_cost_budget_cents == null ? '' : String(Math.round(settings.daily_cost_budget_cents / 100)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.updateSettings({
        max_requested_stems_per_run: Number.parseInt(maxStems, 10),
        daily_token_budget: parseNullableInt(dailyTokens),
        daily_cost_budget_cents: dailyCost.trim() ? Math.round(Number.parseFloat(dailyCost) * 100) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save generation settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets and run limits</CardTitle>
        <CardDescription>Global caps used by tutor-web generation runs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Max requested stems</Label>
            <Input type="number" min={1} max={50} value={maxStems} onChange={(e) => setMaxStems(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Daily token budget</Label>
            <Input value={dailyTokens} onChange={(e) => setDailyTokens(e.target.value)} placeholder="No cap" />
          </div>
          <div className="space-y-2">
            <Label>Daily cost budget ($)</Label>
            <Input value={dailyCost} onChange={(e) => setDailyCost(e.target.value)} placeholder="No cap" />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save budgets'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProviderCard({ provider, onSaved }: { provider: UcatGenerationProvider; onSaved: () => void }) {
  const [form, setForm] = useState(provider);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(provider);
  }, [provider]);

  async function save() {
    setSaving(true);
    try {
      await ucatGenerationSettingsApi.updateProvider(provider.id, form);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider.name}</CardTitle>
        <CardDescription>Secret value is read server-side from {provider.secret_env_var_name}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Provider key</Label>
          <Input value={form.provider_key} onChange={(e) => setForm({ ...form, provider_key: e.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Base URL</Label>
          <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Secret env var</Label>
          <Input value={form.secret_env_var_name} onChange={(e) => setForm({ ...form, secret_env_var_name: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 pt-8 text-sm">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
          />
          Enabled
        </label>
        <div className="md:col-span-2">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save provider'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModelProfileDialog({
  profile,
  providers,
  onOpenChange,
  onSaved,
}: {
  profile: UcatGenerationModelProfile | null;
  providers: UcatGenerationProvider[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UcatGenerationModelProfile | null>(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  async function save() {
    if (!profile || !form) return;
    setSaving(true);
    try {
      await ucatGenerationSettingsApi.updateModelProfile(profile.id, form);
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!profile} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? `Edit ${profile.name}` : 'Edit model profile'}</DialogTitle>
        </DialogHeader>
        {form ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <SearchableSelect<UcatGenerationProvider>
                  items={providers}
                  value={providers.find((provider) => provider.id === form.provider_id) ?? null}
                  onValueChange={(provider) => {
                    if (provider) setForm({ ...form, provider_id: provider.id });
                  }}
                  getItemId={(provider) => provider.id}
                  getItemLabel={(provider) => provider.name}
                  searchPlaceholder="Search providers..."
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  max={2}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max completion tokens</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_completion_tokens}
                  onChange={(e) => setForm({ ...form, max_completion_tokens: Number.parseInt(e.target.value, 10) })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                Default
              </label>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ModelProfilesTable({
  profiles,
  providers,
  onSaved,
}: {
  profiles: UcatGenerationModelProfile[];
  providers: UcatGenerationProvider[];
  onSaved: () => void;
}) {
  const [editingProfile, setEditingProfile] = useState<UcatGenerationModelProfile | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Model profiles</CardTitle>
          <CardDescription>Provider and model inference parameters used by generation.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 font-medium">Temperature</th>
                <th className="py-2 pr-3 font-medium">Max tokens</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="cursor-pointer border-b hover:bg-muted/50"
                  onClick={() => setEditingProfile(profile)}
                >
                  <td className="py-3 pr-3 font-medium">{profile.name}</td>
                  <td className="py-3 pr-3">{providerName(providers, profile.provider_id)}</td>
                  <td className="py-3 pr-3">{profile.model}</td>
                  <td className="py-3 pr-3">{profile.temperature}</td>
                  <td className="py-3 pr-3">{profile.max_completion_tokens}</td>
                  <td className="py-3 pr-3">
                    {profile.is_default ? 'Default' : profile.is_enabled ? 'Enabled' : 'Disabled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ModelProfileDialog
        profile={editingProfile}
        providers={providers}
        onSaved={onSaved}
        onOpenChange={(open) => {
          if (!open) setEditingProfile(null);
        }}
      />
    </>
  );
}

const SYSTEM_PROMPT_FIELDS: Array<{
  key: keyof Pick<
    UcatGenerationSystemPrompts,
    'base_system_prompt' | 'planner_prompt' | 'writer_prompt' | 'critic_prompt' | 'rewriter_prompt'
  >;
  label: string;
}> = [
  { key: 'base_system_prompt', label: 'Base system prompt' },
  { key: 'planner_prompt', label: 'Planner prompt' },
  { key: 'writer_prompt', label: 'Writer prompt' },
  { key: 'critic_prompt', label: 'Critic prompt' },
  { key: 'rewriter_prompt', label: 'Rewriter prompt' },
];

function SystemPromptsForm({ prompts, onSaved }: { prompts: UcatGenerationSystemPrompts; onSaved: () => void }) {
  const [form, setForm] = useState(prompts);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(prompts);
  }, [prompts]);

  async function save() {
    setSaving(true);
    try {
      await ucatGenerationSettingsApi.updateSystemPrompts({
        ...form,
        prompt_version: prompts.prompt_version + 1,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System prompts</CardTitle>
        <CardDescription>Model-independent role instructions shared by every UCAT generation model.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {SYSTEM_PROMPT_FIELDS.map(({ key, label }) => (
            <div key={key} className={key === 'base_system_prompt' ? 'space-y-2 lg:col-span-2' : 'space-y-2'}>
              <Label>{label}</Label>
              <Textarea
                className="min-h-40"
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save system prompts'}
          </Button>
          <span className="text-sm text-muted-foreground">Version {prompts.prompt_version}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PromptLayerForm({
  layers,
  options,
  onSaved,
}: {
  layers: UcatGenerationPromptLayer[];
  options: UcatGenerationSettingsBundle['taxonomyOptions'];
  onSaved: () => void;
}) {
  const [scopeType, setScopeType] = useState<UcatGenerationPromptLayer['scope_type']>('section');
  const filteredOptions = useMemo(() => options.filter((option) => option.scope_type === scopeType), [options, scopeType]);
  const [scopeId, setScopeId] = useState('');
  const existing = layers.find((layer) => layer.scope_type === scopeType && layer.scope_id === scopeId) ?? null;
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScopeId(filteredOptions[0]?.id ?? '');
  }, [filteredOptions]);

  useEffect(() => {
    setPrompt(existing?.prompt_text ?? '');
  }, [existing]);

  async function save() {
    if (!scopeId) return;
    setSaving(true);
    try {
      await ucatGenerationSettingsApi.upsertPromptLayer({
        id: existing?.id,
        scope_type: scopeType,
        scope_id: scopeId,
        prompt_text: prompt,
        prompt_version: (existing?.prompt_version ?? 0) + 1,
        is_enabled: true,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt layers</CardTitle>
        <CardDescription>Section, category, and tag instructions injected into generation prompts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Scope</Label>
            <SearchableSelect<ScopeOption>
              items={SCOPE_OPTIONS}
              value={SCOPE_OPTIONS.find((option) => option.id === scopeType) ?? null}
              onValueChange={(option) => {
                if (option) setScopeType(option.id);
              }}
              getItemId={(option) => option.id}
              getItemLabel={(option) => option.label}
              searchPlaceholder="Search scopes..."
            />
          </div>
          <div className="space-y-2">
            <Label>Target</Label>
            <SearchableSelect<UcatGenerationSettingsBundle['taxonomyOptions'][number]>
              items={filteredOptions}
              value={filteredOptions.find((option) => option.id === scopeId) ?? null}
              onValueChange={(option) => setScopeId(option?.id ?? '')}
              getItemId={(option) => option.id}
              getItemLabel={(option) => (option.section_name ? `${option.section_name} / ${option.name}` : option.name)}
              placeholder={filteredOptions.length > 0 ? 'Select target' : 'No targets available'}
              searchPlaceholder="Search targets..."
              emptyMessage="No targets found"
              disabled={filteredOptions.length === 0}
            />
          </div>
        </div>
        <Textarea className="min-h-40" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <Button type="button" onClick={save} disabled={saving || !scopeId}>
          {saving ? 'Saving...' : existing ? 'Update prompt layer' : 'Create prompt layer'}
        </Button>
      </CardContent>
    </Card>
  );
}

export function UcatGenerationSettingsPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', data: null, error: null });
  const [creatingModelProfile, setCreatingModelProfile] = useState(false);

  async function load() {
    setLoadState({ status: 'loading', data: null, error: null });
    try {
      const data = await ucatGenerationSettingsApi.getBundle();
      setLoadState({ status: 'ready', data, error: null });
    } catch (err) {
      setLoadState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Failed to load settings' });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loadState.status === 'loading') return <p className="text-sm text-muted-foreground">Loading UCAT generation settings...</p>;
  if (loadState.status === 'error') return <p className="text-sm text-destructive">{loadState.error}</p>;

  const bundle = loadState.data;

  async function createModelProfile() {
    const provider = bundle.providers.find((item) => item.is_enabled) ?? bundle.providers[0];
    const template = bundle.modelProfiles[0];
    if (!provider) return;
    setCreatingModelProfile(true);
    try {
      await ucatGenerationSettingsApi.createModelProfile({
        name: `New model ${bundle.modelProfiles.length + 1}`,
        provider_id: provider.id,
        model: template?.model ?? 'openai/gpt-4o-mini',
        is_enabled: true,
        is_default: false,
        temperature: template?.temperature ?? 0.8,
        max_completion_tokens: template?.max_completion_tokens ?? 6000,
      });
      await load();
    } finally {
      setCreatingModelProfile(false);
    }
  }

  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="prompts">Prompts</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <SettingsForm settings={bundle.settings} onSaved={load} />
      </TabsContent>

      <TabsContent value="providers" className="space-y-4">
        {bundle.providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} onSaved={load} />
        ))}
      </TabsContent>

      <TabsContent value="models" className="space-y-4">
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" onClick={createModelProfile} disabled={creatingModelProfile || bundle.providers.length === 0}>
            {creatingModelProfile ? 'Creating...' : 'Add model profile'}
          </Button>
        </div>
        <ModelProfilesTable
          profiles={bundle.modelProfiles}
          providers={bundle.providers}
          onSaved={load}
        />
      </TabsContent>

      <TabsContent value="prompts" className="space-y-6">
        <SystemPromptsForm prompts={bundle.systemPrompts} onSaved={load} />
        <PromptLayerForm layers={bundle.promptLayers} options={bundle.taxonomyOptions} onSaved={load} />
      </TabsContent>
    </Tabs>
  );
}
