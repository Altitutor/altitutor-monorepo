'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Info, Plus, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DataTable,
  Input,
  Label,
  SearchableSelect,
  SegmentedControl,
  SegmentedTabPanelContent,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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

const VALID_TABS = ['general', 'providers', 'models', 'prompts'] as const;
type SettingsTab = (typeof VALID_TABS)[number];

type SystemPromptKey = keyof Pick<
  UcatGenerationSystemPrompts,
  'base_system_prompt' | 'planner_prompt' | 'writer_prompt' | 'critic_prompt' | 'rewriter_prompt'
>;

type SystemPromptRow = {
  key: SystemPromptKey;
  label: string;
  description: string;
  prompt: string;
  version: number;
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

function FieldLabel({
  label,
  description,
  htmlFor,
}: {
  label: string;
  description: string;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`About ${label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{description}</TooltipContent>
      </Tooltip>
    </div>
  );
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
            <FieldLabel
              label="Max requested stems"
              description="The largest number of question stems a tutor can request in one generation run. Lower values limit request duration and peak API usage."
              htmlFor="max-requested-stems"
            />
            <Input id="max-requested-stems" type="number" min={1} max={50} value={maxStems} onChange={(e) => setMaxStems(e.target.value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel
              label="Daily token budget"
              description="Stops new generation calls after the total provider-reported input and output tokens for the day reaches this amount. Leave blank for no token cap."
              htmlFor="daily-token-budget"
            />
            <Input id="daily-token-budget" value={dailyTokens} onChange={(e) => setDailyTokens(e.target.value)} placeholder="No cap" />
          </div>
          <div className="space-y-2">
            <FieldLabel
              label="Daily cost budget ($)"
              description="Stops new generation calls after recorded estimated API cost reaches this daily amount. Leave blank for no cost cap."
              htmlFor="daily-cost-budget"
            />
            <Input id="daily-cost-budget" value={dailyCost} onChange={(e) => setDailyCost(e.target.value)} placeholder="No cap" />
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
  open,
  profile,
  providers,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  profile: UcatGenerationModelProfile | null;
  providers: UcatGenerationProvider[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UcatGenerationModelProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      profile ?? {
        id: '',
        name: '',
        provider_id: providers.find((provider) => provider.is_enabled)?.id ?? providers[0]?.id ?? '',
        model: 'openai/gpt-4o-mini',
        temperature: 0.8,
        max_completion_tokens: 6000,
        is_enabled: true,
        is_default: false,
      },
    );
    setError(null);
  }, [open, profile, providers]);

  async function save() {
    if (!form || !form.name.trim() || !form.provider_id || !form.model.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (profile) {
        await ucatGenerationSettingsApi.updateModelProfile(profile.id, form);
      } else {
        await ucatGenerationSettingsApi.createModelProfile({
          name: form.name,
          provider_id: form.provider_id,
          model: form.model,
          temperature: form.temperature,
          max_completion_tokens: form.max_completion_tokens,
          is_enabled: form.is_enabled,
          is_default: form.is_default,
        });
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>{profile ? `Edit ${profile.name}` : 'Add model profile'}</DialogTitle>
              <DialogDescription>
                Configure provider and inference parameters. Prompt instructions are managed separately.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {form ? (
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="Name" description="An admin-facing label used to identify this model configuration." htmlFor="model-profile-name" />
                <Input id="model-profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <FieldLabel label="Provider" description="The API endpoint and server-side credential used to call this model." />
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
                <FieldLabel label="Model" description="The exact provider model identifier sent with generation requests, for example openai/gpt-4o-mini." htmlFor="model-id" />
                <Input id="model-id" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div className="space-y-2">
                <FieldLabel label="Temperature" description="Controls sampling variability. Lower values are more repeatable; higher values produce more variation but can reduce answer consistency." htmlFor="model-temperature" />
                <Input
                  id="model-temperature"
                  type="number"
                  step="0.05"
                  min={0}
                  max={2}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: Number.parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel label="Max completion tokens" description="The maximum output-token allowance for one model response. It limits response length and cost; setting it too low can truncate generated JSON." htmlFor="model-max-tokens" />
                <Input
                  id="model-max-tokens"
                  type="number"
                  min={1}
                  value={form.max_completion_tokens}
                  onChange={(e) => setForm({ ...form, max_completion_tokens: Number.parseInt(e.target.value, 10) })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm" title="Disabled profiles are hidden from tutor model selection.">
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm" title="Used when no model profile is explicitly selected.">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                Default
              </label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !form?.name.trim() || !form?.provider_id || !form?.model.trim()}>
            {saving ? 'Saving...' : profile ? 'Save model profile' : 'Add model profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelProfilesTable({
  profiles,
  providers,
  onAdd,
  onSaved,
}: {
  profiles: UcatGenerationModelProfile[];
  providers: UcatGenerationProvider[];
  onAdd: () => void;
  onSaved: () => void;
}) {
  const [editingProfile, setEditingProfile] = useState<UcatGenerationModelProfile | null>(null);
  const columns = useMemo<ColumnDef<UcatGenerationModelProfile>[]>(
    () => [
      { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'provider_id', header: 'Provider', cell: ({ row }) => providerName(providers, row.original.provider_id) },
      { accessorKey: 'model', header: 'Model' },
      { accessorKey: 'temperature', header: 'Temperature' },
      { accessorKey: 'max_completion_tokens', header: 'Max completion tokens' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => row.original.is_default ? 'Default' : row.original.is_enabled ? 'Enabled' : 'Disabled',
      },
    ],
    [providers],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Model profiles</CardTitle>
              <CardDescription>Provider and model inference parameters used by generation.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add model profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={profiles}
            searchKey="name"
            pagination="external"
            bodyRowClassName="cursor-pointer"
            onRowClick={setEditingProfile}
          />
        </CardContent>
      </Card>
      <ModelProfileDialog
        open={!!editingProfile}
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
  key: SystemPromptKey;
  label: string;
  description: string;
}> = [
  { key: 'base_system_prompt', label: 'Base system prompt', description: 'Shared instructions applied to every UCAT generation model call.' },
  { key: 'planner_prompt', label: 'Planner prompt', description: 'Instructions reserved for planning diverse generation work.' },
  { key: 'writer_prompt', label: 'Writer prompt', description: 'Instructions used by the live question-writing call.' },
  { key: 'critic_prompt', label: 'Critic prompt', description: 'Instructions reserved for independent AI moderation.' },
  { key: 'rewriter_prompt', label: 'Rewriter prompt', description: 'Instructions reserved for repairing salvageable candidates.' },
];

function SystemPromptDialog({
  row,
  prompts,
  onOpenChange,
  onSaved,
}: {
  row: SystemPromptRow | null;
  prompts: UcatGenerationSystemPrompts;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt(row?.prompt ?? '');
    setError(null);
  }, [row]);

  async function save() {
    if (!row) return;
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.updateSystemPrompts({
        [row.key]: prompt,
        prompt_version: prompts.prompt_version + 1,
      });
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save system prompt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>{row?.label ?? 'Edit system prompt'}</DialogTitle>
              <DialogDescription>{row?.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 space-y-2 overflow-y-auto p-6">
          <FieldLabel label="Prompt" description="Model-independent instructions combined with the selected scoped prompts at runtime." htmlFor="system-prompt-text" />
          <Textarea id="system-prompt-text" className="min-h-80" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !prompt.trim()}>{saving ? 'Saving...' : 'Save prompt'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SystemPromptsTable({ prompts, onSaved }: { prompts: UcatGenerationSystemPrompts; onSaved: () => void }) {
  const [editingRow, setEditingRow] = useState<SystemPromptRow | null>(null);
  const rows = useMemo<SystemPromptRow[]>(
    () => SYSTEM_PROMPT_FIELDS.map((field) => ({ ...field, prompt: prompts[field.key], version: prompts.prompt_version })),
    [prompts],
  );
  const columns = useMemo<ColumnDef<SystemPromptRow>[]>(
    () => [
      { accessorKey: 'label', header: 'Prompt', cell: ({ row }) => <span className="font-medium">{row.original.label}</span> },
      { accessorKey: 'description', header: 'Purpose' },
      { accessorKey: 'prompt', header: 'Instructions', cell: ({ row }) => <span className="line-clamp-2 max-w-2xl text-muted-foreground">{row.original.prompt}</span> },
      { accessorKey: 'version', header: 'Version' },
    ],
    [],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>System prompts</CardTitle>
          <CardDescription>Model-independent role instructions shared by every UCAT generation model.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={rows} pagination="external" bodyRowClassName="cursor-pointer" onRowClick={setEditingRow} />
        </CardContent>
      </Card>
      <SystemPromptDialog
        row={editingRow}
        prompts={prompts}
        onSaved={onSaved}
        onOpenChange={(open) => { if (!open) setEditingRow(null); }}
      />
    </>
  );
}

function PromptLayerDialog({
  open,
  layer,
  options,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  layer: UcatGenerationPromptLayer | null;
  options: UcatGenerationSettingsBundle['taxonomyOptions'];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [scopeType, setScopeType] = useState<UcatGenerationPromptLayer['scope_type']>('section');
  const filteredOptions = useMemo(() => options.filter((option) => option.scope_type === scopeType), [options, scopeType]);
  const [scopeId, setScopeId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextScopeType = layer?.scope_type ?? 'section';
    const nextOptions = options.filter((option) => option.scope_type === nextScopeType);
    setScopeType(nextScopeType);
    setScopeId(layer?.scope_id ?? nextOptions[0]?.id ?? '');
    setPrompt(layer?.prompt_text ?? '');
    setEnabled(layer?.is_enabled ?? true);
    setError(null);
  }, [open, layer, options]);

  async function save() {
    if (!scopeId) return;
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.upsertPromptLayer({
        id: layer?.id,
        scope_type: scopeType,
        scope_id: scopeId,
        prompt_text: prompt,
        prompt_version: (layer?.prompt_version ?? 0) + 1,
        is_enabled: enabled,
      });
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt layer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
            <div>
              <DialogTitle>{layer ? 'Edit prompt layer' : 'Add prompt layer'}</DialogTitle>
              <DialogDescription>Apply additional instructions to one section, stem category, or question tag.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel label="Scope" description="Determines whether this prompt applies to a whole UCAT section, one stem category, or one question tag." />
            <SearchableSelect<ScopeOption>
              items={SCOPE_OPTIONS}
              value={SCOPE_OPTIONS.find((option) => option.id === scopeType) ?? null}
              onValueChange={(option) => {
                if (!option) return;
                setScopeType(option.id);
                setScopeId(options.find((target) => target.scope_type === option.id)?.id ?? '');
              }}
              getItemId={(option) => option.id}
              getItemLabel={(option) => option.label}
              searchPlaceholder="Search scopes..."
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Target" description="The exact taxonomy item that activates this prompt during generation." />
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
        <div className="space-y-2">
          <FieldLabel label="Prompt" description="These instructions are added after the shared system and section rules when this target is selected." htmlFor="prompt-layer-text" />
          <Textarea id="prompt-layer-text" className="min-h-64" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enabled
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !scopeId || !prompt.trim()}>
            {saving ? 'Saving...' : layer ? 'Save prompt layer' : 'Add prompt layer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptLayersTable({
  layers,
  options,
  onSaved,
}: {
  layers: UcatGenerationPromptLayer[];
  options: UcatGenerationSettingsBundle['taxonomyOptions'];
  onSaved: () => void;
}) {
  const [editingLayer, setEditingLayer] = useState<UcatGenerationPromptLayer | null>(null);
  const [creating, setCreating] = useState(false);
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const columns = useMemo<ColumnDef<UcatGenerationPromptLayer>[]>(
    () => [
      {
        accessorKey: 'scope_type',
        header: 'Scope',
        cell: ({ row }) => SCOPE_OPTIONS.find((option) => option.id === row.original.scope_type)?.label ?? row.original.scope_type,
      },
      {
        accessorKey: 'scope_id',
        header: 'Target',
        cell: ({ row }) => {
          const option = optionById.get(row.original.scope_id);
          return option ? (option.section_name ? `${option.section_name} / ${option.name}` : option.name) : 'Unknown target';
        },
      },
      { accessorKey: 'prompt_text', header: 'Instructions', cell: ({ row }) => <span className="line-clamp-2 max-w-2xl text-muted-foreground">{row.original.prompt_text}</span> },
      { accessorKey: 'prompt_version', header: 'Version' },
      { accessorKey: 'is_enabled', header: 'Status', cell: ({ row }) => row.original.is_enabled ? 'Enabled' : 'Disabled' },
    ],
    [optionById],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Prompt layers</CardTitle>
              <CardDescription>Section, category, and tag instructions injected into generation prompts.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add prompt layer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={layers} searchKey="prompt_text" pagination="external" bodyRowClassName="cursor-pointer" onRowClick={setEditingLayer} />
        </CardContent>
      </Card>
      <PromptLayerDialog
        open={creating || !!editingLayer}
        layer={editingLayer}
        options={options}
        onSaved={onSaved}
        onOpenChange={(open) => { if (!open) { setCreating(false); setEditingLayer(null); } }}
      />
    </>
  );
}

export function UcatGenerationSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', data: null, error: null });
  const [creatingModelProfile, setCreatingModelProfile] = useState(false);
  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = VALID_TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : 'general';

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadState({ status: 'loading', data: null, error: null });
    try {
      const data = await ucatGenerationSettingsApi.getBundle();
      setLoadState({ status: 'ready', data, error: null });
    } catch (err) {
      setLoadState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Failed to load settings' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleTabChange(value: string) {
    const nextTab = VALID_TABS.includes(value as SettingsTab) ? (value as SettingsTab) : 'general';
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'general') params.delete('tab');
    else params.set('tab', nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (loadState.status === 'loading') return <p className="text-sm text-muted-foreground">Loading UCAT generation settings...</p>;
  if (loadState.status === 'error') return <p className="text-sm text-destructive">{loadState.error}</p>;

  const bundle = loadState.data;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <SegmentedControl
        className="w-full max-w-xl min-w-0"
        fullWidth
        value={activeTab}
        onValueChange={handleTabChange}
        options={[
          { value: 'general', label: 'General' },
          { value: 'providers', label: 'Providers' },
          { value: 'models', label: 'Models' },
          { value: 'prompts', label: 'Prompts' },
        ]}
      />

      <SegmentedTabPanelContent when="general" activeTab={activeTab}>
        <SettingsForm settings={bundle.settings} onSaved={() => load(false)} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="providers" activeTab={activeTab} className="space-y-4">
        {bundle.providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} onSaved={() => load(false)} />
        ))}
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="models" activeTab={activeTab} className="space-y-4">
        <ModelProfilesTable
          profiles={bundle.modelProfiles}
          providers={bundle.providers}
          onAdd={() => setCreatingModelProfile(true)}
          onSaved={() => load(false)}
        />
        <ModelProfileDialog
          open={creatingModelProfile}
          profile={null}
          providers={bundle.providers}
          onSaved={() => load(false)}
          onOpenChange={setCreatingModelProfile}
        />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="prompts" activeTab={activeTab} className="space-y-6">
        <SystemPromptsTable prompts={bundle.systemPrompts} onSaved={() => load(false)} />
        <PromptLayersTable layers={bundle.promptLayers} options={bundle.taxonomyOptions} onSaved={() => load(false)} />
      </SegmentedTabPanelContent>
    </div>
    </TooltipProvider>
  );
}
