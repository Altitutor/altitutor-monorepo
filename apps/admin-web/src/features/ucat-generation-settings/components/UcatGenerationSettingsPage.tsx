'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from '@altitutor/ui';
import {
  ucatGenerationSettingsApi,
  type UcatGenerationProfile,
  type UcatGenerationPromptLayer,
  type UcatGenerationProvider,
  type UcatGenerationSettings,
  type UcatGenerationSettingsBundle,
} from '@/features/ucat-generation-settings/api/ucat-generation-settings';

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: UcatGenerationSettingsBundle; error: null }
  | { status: 'error'; data: null; error: string };

function parseNullableInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function SettingsForm({ settings, onSaved }: { settings: UcatGenerationSettings; onSaved: () => void }) {
  const [maxCandidates, setMaxCandidates] = useState(String(settings.max_candidates_per_stem));
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
        max_candidates_per_stem: Number.parseInt(maxCandidates, 10),
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Max candidates per stem</Label>
            <Input type="number" min={1} max={5} value={maxCandidates} onChange={(e) => setMaxCandidates(e.target.value)} />
          </div>
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

function ProfileCard({
  profile,
  providers,
  globalMaxCandidates,
  onSaved,
}: {
  profile: UcatGenerationProfile;
  providers: UcatGenerationProvider[];
  globalMaxCandidates: number;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await ucatGenerationSettingsApi.updateProfile(profile.id, {
        ...form,
        candidates_per_stem: Math.min(Number(form.candidates_per_stem), globalMaxCandidates),
        profile_version: profile.profile_version + 1,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.name}</CardTitle>
        <CardDescription>Version {profile.profile_version}. Tutors can choose enabled profiles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={form.provider_id}
              onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Candidates per stem</Label>
            <Input
              type="number"
              min={1}
              max={globalMaxCandidates}
              value={form.candidates_per_stem}
              onChange={(e) => setForm({ ...form, candidates_per_stem: Number.parseInt(e.target.value, 10) })}
            />
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
        <div className="grid gap-4 lg:grid-cols-2">
          {(['base_system_prompt', 'planner_prompt', 'writer_prompt', 'critic_prompt', 'rewriter_prompt'] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label>{key.replaceAll('_', ' ')}</Label>
              <Textarea
                className="min-h-32"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
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
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as UcatGenerationPromptLayer['scope_type'])}
            >
              <option value="section">Section</option>
              <option value="stem_category">Stem category</option>
              <option value="question_tag">Question tag</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Target</Label>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              {filteredOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.section_name ? `${option.section_name} / ${option.name}` : option.name}
                </option>
              ))}
            </select>
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
  const [creatingProfile, setCreatingProfile] = useState(false);

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

  async function createProfile() {
    const provider = bundle.providers.find((item) => item.is_enabled) ?? bundle.providers[0];
    const template = bundle.profiles[0];
    if (!provider || !template) return;
    setCreatingProfile(true);
    try {
      await ucatGenerationSettingsApi.createProfile({
        name: `New profile ${bundle.profiles.length + 1}`,
        provider_id: provider.id,
        model: template.model,
        is_enabled: true,
        is_default: false,
        candidates_per_stem: Math.min(template.candidates_per_stem, bundle.settings.max_candidates_per_stem),
        temperature: template.temperature,
        max_completion_tokens: template.max_completion_tokens,
        base_system_prompt: template.base_system_prompt,
        planner_prompt: template.planner_prompt,
        writer_prompt: template.writer_prompt,
        critic_prompt: template.critic_prompt,
        rewriter_prompt: template.rewriter_prompt,
      });
      await load();
    } finally {
      setCreatingProfile(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsForm settings={bundle.settings} onSaved={load} />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Providers</h2>
        {bundle.providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} onSaved={load} />
        ))}
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Generation profiles</h2>
          <Button type="button" variant="outline" onClick={createProfile} disabled={creatingProfile || bundle.providers.length === 0 || bundle.profiles.length === 0}>
            {creatingProfile ? 'Creating...' : 'Add profile'}
          </Button>
        </div>
        {bundle.profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            providers={bundle.providers}
            globalMaxCandidates={bundle.settings.max_candidates_per_stem}
            onSaved={load}
          />
        ))}
      </section>
      <PromptLayerForm layers={bundle.promptLayers} options={bundle.taxonomyOptions} onSaved={load} />
    </div>
  );
}
