'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Info, Plus, ChevronDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  SearchableSelect,
  SegmentedControl,
  SegmentedTabPanelContent,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@altitutor/ui';
import {
  ucatGenerationSettingsApi,
  type UcatGenerationModelProfile,
  type UcatGenerationOAuthAccount,
  type UcatGenerationPromptLayer,
  type UcatGenerationProvider,
  type UcatGenerationSettings,
  type UcatGenerationSettingsBundle,
  type UcatGenerationSystemPrompts,
} from '@/features/ucat-generation-settings/api/ucat-generation-settings';
import { AdminDialogShell, AdminPageActionButton, SettingsDataTable, SettingsPageHeader, type SettingsDataTableColumn } from '@/shared/components';

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: UcatGenerationSettingsBundle; error: null }
  | { status: 'error'; data: null; error: string };

type ScopeOption = {
  id: UcatGenerationPromptLayer['scope_type'];
  label: string;
};

type GeneralSettingRow = {
  key: keyof Pick<UcatGenerationSettings, 'max_requested_stems_per_run' | 'daily_token_budget' | 'daily_cost_budget_cents'>;
  label: string;
  value: string;
  description: string;
};

const VALID_TABS = ['general', 'providers', 'models', 'prompts'] as const;
type SettingsTab = (typeof VALID_TABS)[number];

type SystemPromptKey = keyof Pick<
  UcatGenerationSystemPrompts,
  'base_system_prompt' | 'planner_prompt' | 'writer_prompt' | 'critic_prompt' | 'rewriter_prompt'
>;

type UnifiedPromptRow =
  | {
      kind: 'system';
      id: string;
      scopeLabel: 'System';
      scopeFilterValue: 'system';
      targetLabel: string;
      instructions: string;
      version: number;
      systemKey: SystemPromptKey;
      systemLabel: string;
      systemDescription: string;
    }
  | {
      kind: 'layer';
      id: string;
      scopeLabel: string;
      scopeFilterValue: UcatGenerationPromptLayer['scope_type'];
      targetLabel: string;
      instructions: string;
      version: number;
      isEnabled: boolean;
      layer: UcatGenerationPromptLayer;
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

function systemPromptShortLabel(key: SystemPromptKey): string {
  switch (key) {
    case 'base_system_prompt':
      return 'Base';
    case 'planner_prompt':
      return 'Planner';
    case 'writer_prompt':
      return 'Writer';
    case 'critic_prompt':
      return 'Critic';
    case 'rewriter_prompt':
      return 'Rewriter';
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function promptLayerTargetLabel(
  layer: UcatGenerationPromptLayer,
  optionById: Map<string, UcatGenerationSettingsBundle['taxonomyOptions'][number]>,
): string {
  const option = optionById.get(layer.scope_id);
  return option ? (option.section_name ? `${option.section_name} / ${option.name}` : option.name) : 'Unknown target';
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

function GeneralSettingsDialog({
  open,
  settings,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  settings: UcatGenerationSettings;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [maxStems, setMaxStems] = useState(String(settings.max_requested_stems_per_run));
  const [dailyTokens, setDailyTokens] = useState(settings.daily_token_budget == null ? '' : String(settings.daily_token_budget));
  const [dailyCost, setDailyCost] = useState(
    settings.daily_cost_budget_cents == null ? '' : String(Math.round(settings.daily_cost_budget_cents / 100)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMaxStems(String(settings.max_requested_stems_per_run));
    setDailyTokens(settings.daily_token_budget == null ? '' : String(settings.daily_token_budget));
    setDailyCost(settings.daily_cost_budget_cents == null ? '' : String(Math.round(settings.daily_cost_budget_cents / 100)));
    setError(null);
  }, [open, settings]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.updateSettings({
        max_requested_stems_per_run: Number.parseInt(maxStems, 10),
        daily_token_budget: parseNullableInt(dailyTokens),
        daily_cost_budget_cents: dailyCost.trim() ? Math.round(Number.parseFloat(dailyCost) * 100) : null,
      });
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save generation settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title="Budgets and run limits"
      subtitle="Global caps used by tutor-web generation runs."
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save budgets'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4 py-4">
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
      </div>
    </AdminDialogShell>
  );
}

function GeneralSettingsTable({ settings, onSaved }: { settings: UcatGenerationSettings; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const rows = useMemo<GeneralSettingRow[]>(
    () => [
      {
        key: 'max_requested_stems_per_run',
        label: 'Max requested stems',
        value: String(settings.max_requested_stems_per_run),
        description: 'Largest number of question stems a tutor can request in one generation run.',
      },
      {
        key: 'daily_token_budget',
        label: 'Daily token budget',
        value: settings.daily_token_budget == null ? 'No cap' : settings.daily_token_budget.toLocaleString(),
        description: 'Stops new generation calls when the daily provider-reported token total reaches this amount.',
      },
      {
        key: 'daily_cost_budget_cents',
        label: 'Daily cost budget',
        value: settings.daily_cost_budget_cents == null ? 'No cap' : `$${(settings.daily_cost_budget_cents / 100).toFixed(2)}`,
        description: 'Stops new generation calls when recorded estimated API cost reaches this daily amount.',
      },
    ],
    [settings],
  );
  const columns = useMemo<SettingsDataTableColumn<GeneralSettingRow>[]>(
    () => [
      {
        key: 'label',
        label: 'Setting',
        render: (row) => <span className="font-medium">{row.label}</span>,
        sortValue: (row) => row.label,
        searchValue: (row) => row.label,
      },
      {
        key: 'value',
        label: 'Value',
        render: (row) => row.value,
        sortValue: (row) => row.value,
        searchValue: (row) => row.value,
      },
      {
        key: 'description',
        label: 'Description',
        render: (row) => <span className="text-muted-foreground">{row.description}</span>,
        sortValue: (row) => row.description,
        searchValue: (row) => row.description,
      },
    ],
    [],
  );

  return (
    <>
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.key}
        emptyMessage="No generation settings found."
        searchPlaceholder="Search generation settings..."
        filterKeys={[]}
        defaultSort={{ field: 'label', direction: 'asc' }}
        getActions={() => [
          {
            id: 'edit',
            label: 'Edit settings',
            onSelect: () => setEditing(true),
          },
        ]}
      />
      <GeneralSettingsDialog open={editing} settings={settings} onSaved={onSaved} onOpenChange={setEditing} />
    </>
  );
}

function ProviderDialog({
  provider,
  onOpenChange,
  onSaved,
}: {
  provider: UcatGenerationProvider | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UcatGenerationProvider | null>(provider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(provider);
  }, [provider]);

  async function save() {
    if (!form || !provider) return;
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.updateProvider(provider.id, form);
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialogShell
      open={!!provider}
      onClose={() => onOpenChange(false)}
      title={provider?.name ?? 'Edit provider'}
      subtitle={`Secret value is read server-side from ${provider?.secret_env_var_name ?? 'the configured env var'}.`}
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !form?.name.trim() || !form?.provider_key.trim() || !form?.base_url.trim() || !form?.secret_env_var_name.trim()}
          >
            {saving ? 'Saving...' : 'Save provider'}
          </Button>
        </>
      )}
    >
      {form ? (
        <div className="grid gap-4 py-4 md:grid-cols-2">
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
          {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        </div>
      ) : null}
    </AdminDialogShell>
  );
}

function CreateProviderDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [providerKey, setProviderKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [secretEnvVarName, setSecretEnvVarName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setProviderKey('');
    setBaseUrl('https://openrouter.ai/api/v1');
    setSecretEnvVarName('');
    setIsEnabled(true);
    setError(null);
  }, [open]);

  async function save() {
    if (!name.trim() || !providerKey.trim() || !baseUrl.trim() || !secretEnvVarName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await ucatGenerationSettingsApi.createProvider({
        name: name.trim(),
        provider_key: providerKey.trim(),
        provider_kind: 'chat_completions',
        base_url: baseUrl.trim(),
        secret_env_var_name: secretEnvVarName.trim(),
        is_enabled: isEnabled,
      });
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title="Add chat completions provider"
      subtitle="Configure an API endpoint that uses a server-side secret from an environment variable."
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !name.trim() || !providerKey.trim() || !baseUrl.trim() || !secretEnvVarName.trim()}
          >
            {saving ? 'Creating...' : 'Add provider'}
          </Button>
        </>
      )}
    >
      <div className="grid gap-4 py-4 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel label="Name" description="An admin-facing label used to identify this provider." htmlFor="create-provider-name" />
          <Input id="create-provider-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel label="Provider key" description="A unique slug used internally. Use lowercase letters, numbers, and underscores." htmlFor="create-provider-key" />
          <Input id="create-provider-key" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <FieldLabel label="Base URL" description="The API base URL used for chat completion requests." htmlFor="create-provider-base-url" />
          <Input id="create-provider-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <FieldLabel label="Secret env var" description="The environment variable name that stores this provider's API key on the server." htmlFor="create-provider-secret-env-var" />
          <Input id="create-provider-secret-env-var" value={secretEnvVarName} onChange={(e) => setSecretEnvVarName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          Enabled
        </label>
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      </div>
    </AdminDialogShell>
  );
}

function CodexOAuthProviderDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [flow, setFlow] = useState<{
    deviceAuthId: string;
    userCode: string;
    verificationUrl: string;
    intervalSeconds: number;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFlow(null);
      setMessage(null);
      setError(null);
      setStarting(false);
      setChecking(false);
    }
  }, [open]);

  async function start() {
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/ucat-generation/codex-oauth/start', { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Failed to start Codex OAuth');
      setFlow(json);
      setMessage('Open the verification URL, enter the code, then return here to check the connection.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Codex OAuth');
    } finally {
      setStarting(false);
    }
  }

  async function complete() {
    if (!flow) return;
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/ucat-generation/codex-oauth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceAuthId: flow.deviceAuthId,
          userCode: flow.userCode,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Failed to complete Codex OAuth');
      if (json.status === 'pending') {
        setMessage('Still waiting for approval. Complete the OpenAI device prompt, then check again.');
        return;
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete Codex OAuth');
    } finally {
      setChecking(false);
    }
  }

  return (
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title="Log in to ChatGPT"
      subtitle="Connect a ChatGPT account through the Codex device flow. Tokens are stored encrypted server-side."
      contentClassName="md:max-w-2xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={starting || checking}>Cancel</Button>
          {flow ? (
            <Button type="button" onClick={complete} disabled={checking}>
              {checking ? 'Checking...' : 'Check connection'}
            </Button>
          ) : (
            <Button type="button" onClick={start} disabled={starting}>
              {starting ? 'Starting...' : 'Start sign in'}
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-4 py-4">
        {flow ? (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Verification URL</p>
              <a className="break-all text-sm text-primary underline" href={flow.verificationUrl} target="_blank" rel="noreferrer">
                {flow.verificationUrl}
              </a>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Code</p>
              <p className="font-mono text-2xl tracking-wide">{flow.userCode}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This starts OpenAI's device authorization flow. The browser never receives OAuth access or refresh tokens.
          </p>
        )}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </AdminDialogShell>
  );
}

function ProvidersTable({
  providers,
  oauthAccounts,
  onSaved,
}: {
  providers: UcatGenerationProvider[];
  oauthAccounts: UcatGenerationOAuthAccount[];
  onSaved: () => void;
}) {
  const [editingProvider, setEditingProvider] = useState<UcatGenerationProvider | null>(null);
  const accountByProviderId = useMemo(
    () => new Map(oauthAccounts.map((account) => [account.provider_id, account])),
    [oauthAccounts],
  );
  const columns = useMemo<SettingsDataTableColumn<UcatGenerationProvider>[]>(
    () => [
      {
        key: 'name',
        label: 'Provider',
        render: (provider) => <span className="font-medium">{provider.name}</span>,
        sortValue: (provider) => provider.name,
        searchValue: (provider) => provider.name,
      },
      {
        key: 'provider_kind',
        label: 'Kind',
        render: (provider) => provider.provider_kind === 'codex_oauth' ? 'ChatGPT/Codex OAuth' : 'Chat completions',
        sortValue: (provider) => provider.provider_kind,
        filterValue: (provider) => provider.provider_kind,
        searchValue: (provider) => provider.provider_kind,
      },
      {
        key: 'base_url',
        label: 'Base URL',
        render: (provider) => <span className="line-clamp-1 max-w-md text-muted-foreground">{provider.base_url}</span>,
        sortValue: (provider) => provider.base_url,
        searchValue: (provider) => provider.base_url,
      },
      {
        key: 'connection',
        label: 'Connection',
        render: (provider) => {
          if (provider.provider_kind !== 'codex_oauth') return provider.secret_env_var_name;
          const account = accountByProviderId.get(provider.id);
          return account ? `${account.status} · ${account.label}` : 'Not connected';
        },
        sortValue: (provider) => accountByProviderId.get(provider.id)?.status ?? provider.secret_env_var_name,
        searchValue: (provider) => accountByProviderId.get(provider.id)?.label ?? provider.secret_env_var_name,
      },
      {
        key: 'is_enabled',
        label: 'Status',
        render: (provider) => (provider.is_enabled ? 'Enabled' : 'Disabled'),
        sortValue: (provider) => (provider.is_enabled ? 'Enabled' : 'Disabled'),
        filterValue: (provider) => (provider.is_enabled ? 'enabled' : 'disabled'),
        searchValue: (provider) => (provider.is_enabled ? 'Enabled' : 'Disabled'),
      },
    ],
    [accountByProviderId],
  );

  return (
    <>
      <SettingsDataTable
        data={providers}
        columns={columns}
        getRowId={(provider) => provider.id}
        emptyMessage="No providers found."
        searchPlaceholder="Search providers..."
        filterKeys={['provider_kind', 'is_enabled']}
        filterDefinitions={[
          {
            key: 'provider_kind',
            label: 'Kind',
            options: [
              { label: 'Chat completions', value: 'chat_completions' },
              { label: 'ChatGPT/Codex OAuth', value: 'codex_oauth' },
            ],
          },
          {
            key: 'is_enabled',
            label: 'Status',
            options: [
              { label: 'Enabled', value: 'enabled' },
              { label: 'Disabled', value: 'disabled' },
            ],
          },
        ]}
        defaultSort={{ field: 'name', direction: 'asc' }}
        getActions={(provider) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => setEditingProvider(provider),
          },
        ]}
      />
      <ProviderDialog
        provider={editingProvider}
        onSaved={onSaved}
        onOpenChange={(open) => {
          if (!open) setEditingProvider(null);
        }}
      />
    </>
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
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title={profile ? `Edit ${profile.name}` : 'Add model profile'}
      subtitle="Configure provider and inference parameters. Prompt instructions are managed separately."
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !form?.name.trim() || !form?.provider_id || !form?.model.trim()}>
            {saving ? 'Saving...' : profile ? 'Save model profile' : 'Add model profile'}
          </Button>
        </>
      )}
    >
      {form ? (
        <div className="space-y-5 py-4">
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
    </AdminDialogShell>
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
  const [deletingProfile, setDeletingProfile] = useState<UcatGenerationModelProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<{ id: string; field: 'is_enabled' | 'is_default' } | null>(null);

  const updateProfileField = useCallback(
    async (profile: UcatGenerationModelProfile, field: 'is_enabled' | 'is_default', value: boolean) => {
      setUpdating({ id: profile.id, field });
      try {
        await ucatGenerationSettingsApi.updateModelProfile(profile.id, { [field]: value });
        await onSaved();
      } catch {
        // Switch stays on the server value until reload succeeds.
      } finally {
        setUpdating(null);
      }
    },
    [onSaved],
  );

  async function confirmDeleteProfile() {
    if (!deletingProfile) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await ucatGenerationSettingsApi.deleteModelProfile(deletingProfile.id);
      setDeletingProfile(null);
      await onSaved();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete model profile');
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo<SettingsDataTableColumn<UcatGenerationModelProfile>[]>(
    () => [
      {
        key: 'name',
        label: 'Name',
        render: (profile) => <span className="font-medium">{profile.name}</span>,
        sortValue: (profile) => profile.name,
        searchValue: (profile) => profile.name,
      },
      {
        key: 'provider_id',
        label: 'Provider',
        render: (profile) => providerName(providers, profile.provider_id),
        sortValue: (profile) => providerName(providers, profile.provider_id),
        filterValue: (profile) => profile.provider_id,
        searchValue: (profile) => providerName(providers, profile.provider_id),
      },
      {
        key: 'model',
        label: 'Model',
        render: (profile) => profile.model,
        sortValue: (profile) => profile.model,
        searchValue: (profile) => profile.model,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        render: (profile) => profile.temperature,
        sortValue: (profile) => profile.temperature,
      },
      {
        key: 'max_completion_tokens',
        label: 'Max completion tokens',
        render: (profile) => profile.max_completion_tokens.toLocaleString(),
        sortValue: (profile) => profile.max_completion_tokens,
        searchValue: (profile) => String(profile.max_completion_tokens),
      },
      {
        key: 'is_enabled',
        label: 'Status',
        render: (profile) => (
          <Switch
            checked={profile.is_enabled}
            onCheckedChange={(checked) => void updateProfileField(profile, 'is_enabled', checked)}
            disabled={updating?.id === profile.id}
            aria-label={`${profile.is_enabled ? 'Disable' : 'Enable'} ${profile.name}`}
          />
        ),
        sortValue: (profile) => (profile.is_enabled ? 'Enabled' : 'Disabled'),
        filterValue: (profile) => (profile.is_enabled ? 'enabled' : 'disabled'),
        searchValue: (profile) => (profile.is_enabled ? 'Enabled' : 'Disabled'),
      },
      {
        key: 'is_default',
        label: 'Default',
        render: (profile) => (
          <Switch
            checked={profile.is_default}
            onCheckedChange={(checked) => void updateProfileField(profile, 'is_default', checked)}
            disabled={updating?.id === profile.id}
            aria-label={`${profile.is_default ? 'Remove' : 'Set'} ${profile.name} as default`}
          />
        ),
        sortValue: (profile) => (profile.is_default ? 'Default' : 'Not default'),
        filterValue: (profile) => (profile.is_default ? 'default' : 'not_default'),
        searchValue: (profile) => (profile.is_default ? 'Default' : 'Not default'),
      },
    ],
    [providers, updateProfileField, updating],
  );

  return (
    <>
      <SettingsDataTable
        data={profiles}
        columns={columns}
        getRowId={(profile) => profile.id}
        emptyMessage="No model profiles found."
        searchPlaceholder="Search model profiles..."
        filterKeys={['provider_id', 'is_enabled', 'is_default']}
        filterDefinitions={[
          {
            key: 'provider_id',
            label: 'Provider',
            options: providers.map((provider) => ({ label: provider.name, value: provider.id })),
          },
          {
            key: 'is_enabled',
            label: 'Status',
            options: [
              { label: 'Enabled', value: 'enabled' },
              { label: 'Disabled', value: 'disabled' },
            ],
          },
          {
            key: 'is_default',
            label: 'Default',
            options: [
              { label: 'Default', value: 'default' },
              { label: 'Not default', value: 'not_default' },
            ],
          },
        ]}
        defaultSort={{ field: 'name', direction: 'asc' }}
        getActions={(profile) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => setEditingProfile(profile),
          },
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => {
              setDeleteError(null);
              setDeletingProfile(profile);
            },
          },
        ]}
      />
      <AlertDialog
        open={!!deletingProfile}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeletingProfile(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete model profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{deletingProfile?.name}</span>.
              Existing generation runs that used this profile will keep their history, but tutors will no longer be able
              to select it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteProfile();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete profile'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  row: { key: SystemPromptKey; label: string; description: string } | null;
  prompts: UcatGenerationSystemPrompts;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt(row ? prompts[row.key] : '');
    setError(null);
  }, [row, prompts]);

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
    <AdminDialogShell
      open={!!row}
      onClose={() => onOpenChange(false)}
      title={row?.label ?? 'Edit system prompt'}
      subtitle={row?.description}
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !prompt.trim()}>{saving ? 'Saving...' : 'Save prompt'}</Button>
        </>
      )}
    >
      <div className="space-y-2 py-4">
        <FieldLabel label="Prompt" description="Model-independent instructions combined with the selected scoped prompts at runtime." htmlFor="system-prompt-text" />
        <Textarea id="system-prompt-text" className="min-h-80" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </AdminDialogShell>
  );
}

function PromptsTable({
  prompts,
  layers,
  options,
  onSaved,
  createOpen,
  onCreateOpenChange,
}: {
  prompts: UcatGenerationSystemPrompts;
  layers: UcatGenerationPromptLayer[];
  options: UcatGenerationSettingsBundle['taxonomyOptions'];
  onSaved: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [editingSystemRow, setEditingSystemRow] = useState<Extract<UnifiedPromptRow, { kind: 'system' }> | null>(null);
  const [editingLayer, setEditingLayer] = useState<UcatGenerationPromptLayer | null>(null);
  const [updatingLayerId, setUpdatingLayerId] = useState<string | null>(null);
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  const rows = useMemo<UnifiedPromptRow[]>(() => {
    const systemRows: UnifiedPromptRow[] = SYSTEM_PROMPT_FIELDS.map((field) => ({
      kind: 'system',
      id: `system:${field.key}`,
      scopeLabel: 'System',
      scopeFilterValue: 'system',
      targetLabel: systemPromptShortLabel(field.key),
      instructions: prompts[field.key],
      version: prompts.prompt_version,
      systemKey: field.key,
      systemLabel: field.label,
      systemDescription: field.description,
    }));

    const layerRows: UnifiedPromptRow[] = layers.map((layer) => ({
      kind: 'layer',
      id: `layer:${layer.id}`,
      scopeLabel: SCOPE_OPTIONS.find((option) => option.id === layer.scope_type)?.label ?? layer.scope_type,
      scopeFilterValue: layer.scope_type,
      targetLabel: promptLayerTargetLabel(layer, optionById),
      instructions: layer.prompt_text,
      version: layer.prompt_version,
      isEnabled: layer.is_enabled,
      layer,
    }));

    return [...systemRows, ...layerRows];
  }, [layers, optionById, prompts]);

  const updateLayerEnabled = useCallback(
    async (layer: UcatGenerationPromptLayer, isEnabled: boolean) => {
      setUpdatingLayerId(layer.id);
      try {
        await ucatGenerationSettingsApi.updatePromptLayer(layer.id, { is_enabled: isEnabled });
        await onSaved();
      } catch {
        // Switch stays on the server value until reload succeeds.
      } finally {
        setUpdatingLayerId(null);
      }
    },
    [onSaved],
  );

  const columns = useMemo<SettingsDataTableColumn<UnifiedPromptRow>[]>(
    () => [
      {
        key: 'scope',
        label: 'Scope',
        render: (row) => row.scopeLabel,
        sortValue: (row) => (row.kind === 'system' ? '0-System' : `1-${row.scopeLabel}`),
        filterValue: (row) => row.scopeFilterValue,
        searchValue: (row) => row.scopeLabel,
      },
      {
        key: 'target',
        label: 'Target',
        render: (row) => <span className="font-medium">{row.targetLabel}</span>,
        sortValue: (row) => row.targetLabel,
        searchValue: (row) => row.targetLabel,
      },
      {
        key: 'instructions',
        label: 'Instructions',
        render: (row) => <span className="line-clamp-2 max-w-2xl text-muted-foreground">{row.instructions}</span>,
        sortValue: (row) => row.instructions,
        searchValue: (row) => row.instructions,
      },
      {
        key: 'version',
        label: 'Version',
        visibleByDefault: false,
        render: (row) => row.version,
        sortValue: (row) => row.version,
      },
      {
        key: 'enabled',
        label: 'Enabled',
        render: (row) => {
          if (row.kind === 'system') {
            return (
              <Switch
                checked
                onCheckedChange={(checked) => {
                  if (!checked) {
                    toast({
                      title: 'System prompts cannot be disabled',
                      description: 'Shared system prompts are always active during generation.',
                    });
                  }
                }}
                aria-label={`${row.targetLabel} is always enabled`}
              />
            );
          }

          return (
            <Switch
              checked={row.isEnabled}
              onCheckedChange={(checked) => void updateLayerEnabled(row.layer, checked)}
              disabled={updatingLayerId === row.layer.id}
              aria-label={`${row.isEnabled ? 'Disable' : 'Enable'} ${row.targetLabel}`}
            />
          );
        },
        sortValue: (row) => (row.kind === 'system' || row.isEnabled ? 'Enabled' : 'Disabled'),
        filterValue: (row) => (row.kind === 'system' || row.isEnabled ? 'enabled' : 'disabled'),
        searchValue: (row) => (row.kind === 'system' || row.isEnabled ? 'Enabled' : 'Disabled'),
      },
    ],
    [toast, updateLayerEnabled, updatingLayerId],
  );

  return (
    <>
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage="No prompts found."
        searchPlaceholder="Search prompts..."
        filterKeys={['scope', 'enabled']}
        filterDefinitions={[
          {
            key: 'scope',
            label: 'Scope',
            options: [
              { label: 'System', value: 'system' },
              ...SCOPE_OPTIONS.map((option) => ({ label: option.label, value: option.id })),
            ],
          },
          {
            key: 'enabled',
            label: 'Enabled',
            options: [
              { label: 'Enabled', value: 'enabled' },
              { label: 'Disabled', value: 'disabled' },
            ],
          },
        ]}
        defaultSort={{ field: 'scope', direction: 'asc' }}
        getActions={(row) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => {
              if (row.kind === 'system') {
                setEditingSystemRow(row);
                return;
              }
              setEditingLayer(row.layer);
            },
          },
        ]}
      />
      <SystemPromptDialog
        row={editingSystemRow ? {
          key: editingSystemRow.systemKey,
          label: editingSystemRow.systemLabel,
          description: editingSystemRow.systemDescription,
        } : null}
        prompts={prompts}
        onSaved={onSaved}
        onOpenChange={(open) => { if (!open) setEditingSystemRow(null); }}
      />
      <PromptLayerDialog
        open={createOpen || !!editingLayer}
        layer={editingLayer}
        options={options}
        onSaved={onSaved}
        onOpenChange={(open) => {
          if (!open) {
            onCreateOpenChange(false);
            setEditingLayer(null);
          }
        }}
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
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title={layer ? 'Edit prompt layer' : 'Add prompt layer'}
      subtitle="Apply additional instructions to one section, stem category, or question tag."
      contentClassName="md:max-w-3xl"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !scopeId || !prompt.trim()}>
            {saving ? 'Saving...' : layer ? 'Save prompt layer' : 'Add prompt layer'}
          </Button>
        </>
      )}
    >
      <div className="space-y-5 py-4">
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
    </AdminDialogShell>
  );
}

export function UcatGenerationSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', data: null, error: null });
  const [creatingModelProfile, setCreatingModelProfile] = useState(false);
  const [creatingChatProvider, setCreatingChatProvider] = useState(false);
  const [addingCodexProvider, setAddingCodexProvider] = useState(false);
  const [creatingPromptLayer, setCreatingPromptLayer] = useState(false);
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

  const headerActions = useMemo(() => {
    switch (activeTab) {
      case 'providers':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AdminPageActionButton
                icon={<Plus className="h-4 w-4" />}
                label="Add provider"
                trailingIcon={<ChevronDown className="h-4 w-4" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreatingChatProvider(true)}>
                Chat completions provider
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddingCodexProvider(true)}>
                Log in to ChatGPT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case 'models':
        return (
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add model profile"
            onClick={() => setCreatingModelProfile(true)}
          />
        );
      case 'prompts':
        return (
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add prompt layer"
            onClick={() => setCreatingPromptLayer(true)}
          />
        );
      default:
        return undefined;
    }
  }, [activeTab]);

  if (loadState.status === 'loading') {
    return (
      <div className="space-y-6 p-6">
        <SettingsPageHeader title="UCAT generation" actions={headerActions} />
        <p className="text-sm text-muted-foreground">Loading UCAT generation settings...</p>
      </div>
    );
  }

  if (loadState.status === 'error') {
    return (
      <div className="space-y-6 p-6">
        <SettingsPageHeader title="UCAT generation" actions={headerActions} />
        <p className="text-sm text-destructive">{loadState.error}</p>
      </div>
    );
  }

  const bundle = loadState.data;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT generation" actions={headerActions} />
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
        <GeneralSettingsTable settings={bundle.settings} onSaved={() => load(false)} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="providers" activeTab={activeTab}>
        <ProvidersTable providers={bundle.providers} oauthAccounts={bundle.oauthAccounts} onSaved={() => load(false)} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="models" activeTab={activeTab}>
        <ModelProfilesTable
          profiles={bundle.modelProfiles}
          providers={bundle.providers}
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

      <SegmentedTabPanelContent when="prompts" activeTab={activeTab}>
        <PromptsTable
          prompts={bundle.systemPrompts}
          layers={bundle.promptLayers}
          options={bundle.taxonomyOptions}
          onSaved={() => load(false)}
          createOpen={creatingPromptLayer}
          onCreateOpenChange={setCreatingPromptLayer}
        />
      </SegmentedTabPanelContent>

      <CreateProviderDialog
        open={creatingChatProvider}
        onSaved={() => load(false)}
        onOpenChange={setCreatingChatProvider}
      />
      <CodexOAuthProviderDialog
        open={addingCodexProvider}
        onSaved={() => load(false)}
        onOpenChange={setAddingCodexProvider}
      />
    </div>
    </TooltipProvider>
  );
}
