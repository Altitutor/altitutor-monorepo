'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { UcatModelConfigForm } from '@/features/ucat-model-config/components/UcatModelConfigForm';
import { useUcatModelConfig } from '@/features/ucat-model-config/hooks/use-ucat-model-config';

export default function UcatModelConfigPage() {
  const router = useRouter();
  const { data, isLoading, error } = useUcatModelConfig();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">UCAT model config</h1>
          <p className="text-muted-foreground">
            Configure per-section cold-start constants used by student score projections.
          </p>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error.message}</p> : null}

      <div className="grid gap-4">
        {(data ?? []).map((row) => (
          <UcatModelConfigForm key={row.id} initial={row} />
        ))}
      </div>
    </div>
  );
}
