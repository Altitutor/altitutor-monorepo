import { redirect } from 'next/navigation';
import { UcatGenerationSettingsPage } from '@/features/ucat-generation-settings/components/UcatGenerationSettingsPage';

export default async function UcatGenerationSettingsRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  if (tab === 'providers' || tab === 'models') redirect(`/settings/ai-models?tab=${tab}`);
  return <UcatGenerationSettingsPage />;
}
