'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SegmentedControl, SegmentedTabPanelContent } from '@altitutor/ui';
import { AdminLoadingSkeleton, SettingsPageHeader } from '@/shared/components';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatFreeQuotaConfigForm } from '@/features/ucat-subscription-config/components/UcatFreeQuotaConfigForm';
import { UcatFreeTierStudentsTable } from '@/features/ucat-free-tier/components/UcatFreeTierStudentsTable';

const VALID_TABS = ['quotas', 'students'] as const;
type FreeTierTab = (typeof VALID_TABS)[number];

export default function UcatFreeTierSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<UcatSubscriptionConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tabParam = searchParams.get('tab');
  const activeTab: FreeTierTab = VALID_TABS.includes(tabParam as FreeTierTab) ? (tabParam as FreeTierTab) : 'quotas';

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

  function handleTabChange(value: string) {
    const nextTab = VALID_TABS.includes(value as FreeTierTab) ? (value as FreeTierTab) : 'quotas';
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'quotas') params.delete('tab');
    else params.set('tab', nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (loading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT Free tier" />

      {loadError && !config ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <SegmentedControl
        className="w-full max-w-md min-w-0"
        fullWidth
        value={activeTab}
        onValueChange={handleTabChange}
        options={[
          { value: 'quotas', label: 'Quotas' },
          { value: 'students', label: 'Students' },
        ]}
      />

      <SegmentedTabPanelContent when="quotas" activeTab={activeTab}>
        {config ? <UcatFreeQuotaConfigForm initial={config} onSaved={load} /> : null}
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="students" activeTab={activeTab} className="space-y-4">
        <UcatFreeTierStudentsTable />
      </SegmentedTabPanelContent>
    </div>
  );
}
