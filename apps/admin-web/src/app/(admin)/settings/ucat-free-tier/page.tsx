'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@altitutor/ui';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatFreeQuotaConfigForm } from '@/features/ucat-subscription-config/components/UcatFreeQuotaConfigForm';

export default function UcatFreeTierSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<UcatSubscriptionConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const row = await ucatSubscriptionConfigApi.getSingleton();
      setConfig(row);
      if (!row) {
        setLoadError('No UCAT subscription config row found. Apply migrations and ensure the seed ran.');
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load config');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
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
          <h1 className="text-3xl font-bold tracking-tight">UCAT Free tier</h1>
          <p className="text-muted-foreground">
            Configure per-area usage limits for students on UCAT Free
          </p>
        </div>
      </div>

      {loadError && !config ? (
        <p className="mb-4 text-sm text-destructive">{loadError}</p>
      ) : null}

      {config ? <UcatFreeQuotaConfigForm initial={config} onSaved={load} /> : null}
    </div>
  );
}
