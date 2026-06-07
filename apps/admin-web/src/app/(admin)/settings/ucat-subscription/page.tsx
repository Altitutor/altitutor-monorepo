'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatSubscriptionConfigForm } from '@/features/ucat-subscription-config/components/UcatSubscriptionConfigForm';

export default function UcatSubscriptionSettingsPage() {
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">UCAT subscription</h1>
          <p className="text-muted-foreground">
            Pro trial, weekly and monthly pricing, practice-day discounts, and Stripe price IDs
          </p>
        </div>
      </div>

      {loadError && !config ? (
        <p className="text-sm text-destructive mb-4">{loadError}</p>
      ) : null}

      {config ? <UcatSubscriptionConfigForm initial={config} onSaved={load} /> : null}
    </div>
  );
}
