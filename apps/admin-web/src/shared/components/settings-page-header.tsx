'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import type { ReactNode } from 'react';

export function SettingsPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="mb-6 flex items-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => router.push('/settings')}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Back to settings</span>
      </Button>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
