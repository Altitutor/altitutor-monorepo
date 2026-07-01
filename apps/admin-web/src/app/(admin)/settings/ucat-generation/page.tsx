'use client';

import { UcatGenerationSettingsPage } from '@/features/ucat-generation-settings/components/UcatGenerationSettingsPage';
import { SettingsPageHeader } from '@/shared/components';

export default function UcatGenerationSettingsRoute() {
  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT generation" />
      <UcatGenerationSettingsPage />
    </div>
  );
}
