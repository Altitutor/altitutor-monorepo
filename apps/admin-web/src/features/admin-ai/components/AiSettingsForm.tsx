'use client';

import { useActionState } from 'react';
import { Button, Label, Textarea } from '@altitutor/ui';
import { saveAdminAiSettings } from '../server/actions';

export function AiSettingsForm({
  settings,
  profiles,
}: {
  settings: { model_profile_id: string | null; system_prompt: string };
  profiles: { id: string; label: string; available: boolean }[];
}) {
  const [message, action, pending] = useActionState(saveAdminAiSettings, '');
  const selected = profiles.find(({ id }) => id === settings.model_profile_id)?.id ?? '';
  return (
    <form action={action} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="chat-model">Chat model</Label>
        <select id="chat-model" name="model_profile_id" defaultValue={selected} className="w-full rounded-md border bg-background px-3 py-2">
          <option value="">Chat disabled</option>
          {profiles.map(({ id, label, available }) => (
            <option key={id} value={id} disabled={!available && id !== selected}>
              {label}{available ? '' : ' · API key required'}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">Choose a model that supports tool calling. Each step can generate up to 4,096 tokens.</p>
        {settings.model_profile_id && !selected && <p role="status">The selected model is unavailable. Choose another to enable chat.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="chat-system-prompt">System prompt</Label>
        <Textarea id="chat-system-prompt" name="system_prompt" defaultValue={settings.system_prompt} required maxLength={8000} rows={7} />
        <p className="text-sm text-muted-foreground">These instructions apply to staff chat across Altitutor.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
