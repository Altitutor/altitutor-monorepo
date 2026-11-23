import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SettingsPageHeader } from '@/shared/components';
import { AiSettingsForm } from '@/features/admin-ai/components/AiSettingsForm';
import { getAdminAiClient, getChatApiKey, getChatProfiles, getChatProviderKind, getChatSettings } from '@/features/admin-ai/server/settings';

export default async function AiSettingsPage() {
  const client = await getAdminAiClient();
  if (!client) notFound();
  const [settings, profiles] = await Promise.all([getChatSettings(client), getChatProfiles(client)]);

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <SettingsPageHeader title="Staff chat" />
      <AiSettingsForm
        settings={settings}
        profiles={profiles
          .filter(({ provider }) => getChatProviderKind(provider))
          .map(({ id, name, provider }) => ({
            id,
            label: `${name} · ${provider.name}`,
            available: Boolean(getChatApiKey(getChatProviderKind(provider))),
          }))}
      />
      <p className="text-sm text-muted-foreground">
        Manage shared providers and model profiles in{' '}
        <Link className="underline" href="/settings/ai-models">Model providers</Link>.
      </p>
    </div>
  );
}
