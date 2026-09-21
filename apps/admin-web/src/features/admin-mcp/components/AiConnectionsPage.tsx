'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@altitutor/ui';
import { SettingsPageHeader } from '@/shared/components';
import { changeAiConnection, listAiConnections, type ConnectionAction } from '../api/connections';

const connectionsKey = ['admin-mcp', 'connections'];

export function AiConnectionsPage() {
  const [serverUrl, setServerUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const cache = useQueryClient();
  const connections = useQuery({ queryKey: connectionsKey, queryFn: listAiConnections, retry: false });
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ConnectionAction }) => changeAiConnection(id, action),
    onSuccess: () => setDisconnectId(null),
    onSettled: () => cache.invalidateQueries({ queryKey: connectionsKey }),
  });
  useEffect(() => { setServerUrl(`${window.location.origin}/api/mcp`); }, []);
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopyStatus('Server URL copied.');
    } catch {
      setCopyStatus('Unable to copy. Select and copy the URL above.');
    }
  }
  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="AI connections" />
      <section className="space-y-4 rounded-lg border bg-card p-6" aria-labelledby="connect-agent">
        <h2 id="connect-agent" className="text-xl font-semibold">Connect an AI application</h2>
        <p>Give your AI application the Altitutor Admin MCP server URL:</p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="break-all rounded bg-muted px-3 py-2">{serverUrl || 'Loading server URL…'}</code>
          <Button variant="outline" disabled={!serverUrl} onClick={() => void copyUrl()}>Copy URL</Button>
        </div>
        <p role="status" className="text-sm">{copyStatus}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Add this URL as an MCP server in your AI application and choose OAuth authentication.</li>
          <li>Sign in with your administrator account and authorise the application. The shared sign-in screen may open on the tutor portal.</li>
          <li>Return here, refresh the list, and enable admin access for the application.</li>
        </ol>
      </section>
      <section className="space-y-3 rounded-lg border bg-card p-6" aria-labelledby="access-details">
        <h2 id="access-details" className="text-xl font-semibold">What admin access allows</h2>
        <p className="text-sm">Enabled applications can read business and customer information, including financial records, messages and feedback. They can create and edit staff projects, tasks, issues, documents and notes, including visibility and assignments. Tutor-visible document changes take effect immediately.</p>
        <p className="text-sm">These tools cannot send messages, change scheduling or make payments.</p>
        <p className="text-sm text-muted-foreground">Access is currently on or off; there is no reporting-only permission level.</p>
      </section>
      <section className="space-y-4" aria-labelledby="connected-apps">
        <div className="flex items-center justify-between gap-3">
          <h2 id="connected-apps" className="text-xl font-semibold">Your connected applications</h2>
          <Button variant="outline" disabled={connections.isFetching || mutation.isPending} onClick={() => void connections.refetch()}>Refresh</Button>
        </div>
        <p className="text-sm text-muted-foreground">These are applications authorised by your account, not individual agent sessions. Changes here do not affect other administrators’ connections.</p>
        {connections.isPending && <p role="status">Loading connected applications…</p>}
        {connections.error && <p role="alert">{connections.error.message}</p>}
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        {mutation.isSuccess && <p role="status">Application access updated.</p>}
        {connections.data?.length === 0 && <p>No connected applications yet. Connect one using the instructions above.</p>}
        {connections.data?.map((connection) => (
          <article key={connection.id} className="space-y-3 rounded-lg border bg-card p-5" aria-label={connection.name}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{connection.name}</h3>
                <p className="text-sm">Admin access: {connection.enabled ? 'Enabled' : 'Disabled'}</p>
                <p className="break-all text-xs text-muted-foreground">Application ID: {connection.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={mutation.isPending || connections.isFetching} onClick={() => mutation.mutate({ id: connection.id, action: connection.enabled ? 'disable' : 'enable' })}>
                  {connection.enabled ? 'Revoke admin access' : 'Enable admin access'}
                </Button>
                <Button variant="outline" disabled={mutation.isPending} onClick={() => setDisconnectId(connection.id)}>Disconnect application</Button>
              </div>
            </div>
            {disconnectId === connection.id && (
              <div className="space-y-3 rounded border p-3">
                <p>Disconnect {connection.name}? This revokes admin access and your OAuth authorisation for this application, including its other Altitutor access. You will need to authorise it again to reconnect.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: connection.id, action: 'disconnect' })}>Confirm disconnect</Button>
                  <Button variant="outline" disabled={mutation.isPending} onClick={() => setDisconnectId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
