'use client';

import Link from 'next/link';
import { UcatGenerationSettingsPage } from '@/features/ucat-generation-settings/components/UcatGenerationSettingsPage';

export default function UcatGenerationSettingsRoute() {
  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">UCAT generation</h1>
        <p className="mt-1 text-muted-foreground">
          Configure UCAT AI providers, generation profiles, prompt layers, budgets, and gates.
        </p>
      </div>
      <UcatGenerationSettingsPage />
    </div>
  );
}
