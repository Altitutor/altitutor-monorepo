'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Badge, Button } from '@altitutor/ui';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { SettingsPageHeader } from '@/shared/components';
import {
  useImessageConnectorState,
  useImessageControl,
  useRecentImessageCommands,
} from './hooks';
import { getCommandStatusLabel } from './types';
import { ImessageCommandDialog } from './ImessageCommandDialog';

const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function getMetric(metrics: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!metrics) return undefined;
  for (const key of keys) {
    if (metrics[key] !== undefined) return metrics[key];
  }

  for (const namespace of ['bridge', 'bluebubbles', 'outbox', 'health', 'timestamps']) {
    const nested = metrics[namespace];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
    const nestedMetrics = nested as Record<string, unknown>;
    for (const key of keys) {
      if (nestedMetrics[key] !== undefined) return nestedMetrics[key];
    }
  }
  return undefined;
}

function metricBoolean(metrics: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = getMetric(metrics, keys);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', 'connected', 'healthy', 'registered', 'ok'].includes(normalized)) return true;
    if (['false', 'disconnected', 'unhealthy', 'unregistered', 'error'].includes(normalized)) return false;
  }
  return null;
}

function metricNumber(metrics: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = getMetric(metrics, keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function metricTimestamp(metrics: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = getMetric(metrics, keys);
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return new Date(value).toISOString();
  }
  return null;
}

function metricAlerts(metrics: Record<string, unknown> | null | undefined) {
  const value = getMetric(metrics, ['alerts', 'activeAlerts']);
  if (!Array.isArray(value)) return [];
  return value.flatMap((alert, index) => {
    if (typeof alert === 'string') {
      return [{ id: `alert-${index}`, level: 'warning', message: alert }];
    }
    if (!alert || typeof alert !== 'object') return [];
    const item = alert as Record<string, unknown>;
    const message = item.message ?? item.error ?? item.description;
    if (typeof message !== 'string') return [];
    return [{
      id: typeof item.id === 'string' ? item.id : `alert-${index}`,
      level: typeof item.level === 'string' ? item.level : 'warning',
      message,
    }];
  });
}

function HealthValue({ healthy }: { healthy: boolean | null | undefined }) {
  if (healthy === true) {
    return <span className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-600" />Healthy</span>;
  }
  if (healthy === false) {
    return <span className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-destructive" />Unavailable</span>;
  }
  return <span className="text-sm text-muted-foreground">Unknown</span>;
}

export function MessagingSettingsPage() {
  const connector = useImessageConnectorState();
  const commands = useRecentImessageCommands();
  const control = useImessageControl();
  const [restartOpen, setRestartOpen] = useState(false);
  const state = connector.data;
  const metrics = state?.metrics;
  const heartbeatTime = state?.last_heartbeat_at
    ? new Date(state.last_heartbeat_at).getTime()
    : Number.NaN;
  const heartbeatAge = Number.isFinite(heartbeatTime)
    ? Date.now() - heartbeatTime
    : Number.POSITIVE_INFINITY;
  const heartbeatFresh = heartbeatAge >= 0 && heartbeatAge < HEARTBEAT_STALE_MS;
  const bluebubblesConnected = metricBoolean(metrics, [
    'bluebubblesConnected',
    'blueBubblesConnected',
    'bluebubbles_connected',
  ]);
  const privateApiConnected = metricBoolean(metrics, [
    'privateApiConnected',
    'privateAPIConnected',
    'private_api_connected',
  ]);
  const webhookRegistered = metricBoolean(metrics, ['webhookRegistered', 'webhook_registered']);
  const outboxPending = metricNumber(metrics, ['outboxPending', 'outbox_pending']);
  const outboxDead = metricNumber(metrics, ['outboxDead', 'outbox_dead']);
  const lastForwardedAt = metricTimestamp(metrics, ['lastForwardedAt', 'lastForwardAt', 'last_forwarded_at']);
  const lastReconciledAt = metricTimestamp(metrics, ['lastReconciledAt', 'lastReconcileAt', 'last_reconciled_at']);
  const alerts = metricAlerts(metrics);

  const handleRestart = async (reason?: string) => {
    await control.mutateAsync({ commandType: 'restart_messages_app', reason });
    setRestartOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <SettingsPageHeader title="Messaging" />

      {(connector.isLoading || commands.isLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connector diagnostics…
        </div>
      )}

      {connector.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connector diagnostics unavailable</AlertTitle>
          <AlertDescription>{connector.error.message}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-lg border bg-card p-5 space-y-4" aria-labelledby="connector-health">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="connector-health" className="text-lg font-semibold">iMessage connector</h2>
            <p className="text-sm text-muted-foreground">Messaging-only BlueBubbles service health.</p>
          </div>
          <Badge variant={heartbeatFresh ? 'default' : 'destructive'}>
            {heartbeatFresh ? 'Heartbeat fresh' : 'Heartbeat stale'}
          </Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Last heartbeat</dt><dd className="mt-1 text-sm">{formatTimestamp(state?.last_heartbeat_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Connector status</dt><dd className="mt-1 text-sm">{state?.status ?? 'Unknown'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">BlueBubbles</dt><dd className="mt-1"><HealthValue healthy={bluebubblesConnected} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">Private API</dt><dd className="mt-1"><HealthValue healthy={privateApiConnected} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">Webhook</dt><dd className="mt-1"><HealthValue healthy={webhookRegistered} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">Safe server info</dt><dd className="mt-1 text-sm">{state?.host_label ?? 'Unknown'}{state?.app_version ? ` · ${state.app_version}` : ''}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Outbox pending</dt><dd className="mt-1 text-sm">{outboxPending ?? 'Unknown'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Outbox dead</dt><dd className="mt-1 text-sm">{outboxDead ?? 'Unknown'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last forward</dt><dd className="mt-1 text-sm">{formatTimestamp(lastForwardedAt)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last reconcile</dt><dd className="mt-1 text-sm">{formatTimestamp(lastReconciledAt)}</dd></div>
        </dl>
      </section>

      {alerts.map((alert) => (
        <Alert key={alert.id} variant={alert.level === 'error' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connector alert</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}
      {state?.last_error_code && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connector error</AlertTitle>
          <AlertDescription>{state.last_error_code}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-lg border bg-card p-5 space-y-4" aria-labelledby="command-failures">
        <div>
          <h2 id="command-failures" className="text-lg font-semibold">Recent failed or ambiguous commands</h2>
          <p className="text-sm text-muted-foreground">Review operations whose outcome needs attention.</p>
        </div>
        {commands.data?.length ? (
          <div className="divide-y">
            {commands.data.map((command) => (
              <div key={command.id} className="py-3 flex flex-wrap justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{command.command_type.replaceAll('_', ' ')}</div>
                  <div className="text-muted-foreground">
                    {command.error ?? command.reason ?? 'No detail supplied'}
                    {command.attempts > 1 ? ` · ${command.attempts} attempts` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="destructive">{getCommandStatusLabel(command.status)}</Badge>
                  <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(command.completed_at ?? command.updated_at)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent failures or ambiguous outcomes.</p>
        )}
      </section>

      <section className="rounded-lg border border-destructive/30 bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Safe recovery action</h2>
        <p className="text-sm text-muted-foreground">
          Restart Messages.app on the dedicated connector Mac. This is audited and does not restart the Mac or install updates.
        </p>
        <Button variant="destructive" onClick={() => setRestartOpen(true)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Restart Messages.app
        </Button>
      </section>

      <ImessageCommandDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Restart Messages.app?"
        description="Queued messages may be briefly delayed. The reason and administrator confirmation will be audited."
        confirmLabel="Restart Messages.app"
        destructive
        pending={control.isPending}
        onConfirm={handleRestart}
      />
    </div>
  );
}
