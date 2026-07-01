'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SegmentedControl, SegmentedTabPanelContent } from '@altitutor/ui';
import { AdminLoadingSkeleton, SettingsPageHeader } from '@/shared/components';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '@/features/ucat-subscription-config/api/ucat-subscription-config';
import { UcatSubscriptionConfigForm } from '@/features/ucat-subscription-config/components/UcatSubscriptionConfigForm';
import { UcatPlanPricesForm } from '@/features/ucat-subscription-config/components/UcatPlanPricesForm';
import { UcatPracticeDayDiscountForm } from '@/features/ucat-subscription-config/components/UcatPracticeDayDiscountForm';
import { UcatFreeQuotaConfigForm } from '@/features/ucat-subscription-config/components/UcatFreeQuotaConfigForm';
import { UcatFreeTierStudentsTable } from '@/features/ucat-free-tier/components/UcatFreeTierStudentsTable';

const VALID_TABS = ['subscription', 'prices', 'discounts', 'quotas', 'students'] as const;
type BillingTab = (typeof VALID_TABS)[number];

export default function UcatBillingSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<UcatSubscriptionConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tabParam = searchParams.get('tab');
  const activeTab: BillingTab = VALID_TABS.includes(tabParam as BillingTab) ? (tabParam as BillingTab) : 'subscription';

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
    const nextTab = VALID_TABS.includes(value as BillingTab) ? (value as BillingTab) : 'subscription';
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'subscription') params.delete('tab');
    else params.set('tab', nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (loading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT billing" />

      {loadError && !config ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <SegmentedControl
        className="w-full max-w-4xl min-w-0"
        fullWidth
        value={activeTab}
        onValueChange={handleTabChange}
        options={[
          { value: 'subscription', label: 'Subscription' },
          { value: 'prices', label: 'Prices' },
          { value: 'discounts', label: 'Discounts' },
          { value: 'quotas', label: 'Quotas' },
          { value: 'students', label: 'Students' },
        ]}
      />

      <SegmentedTabPanelContent when="subscription" activeTab={activeTab}>
        {config ? <UcatSubscriptionConfigForm initial={config} onSaved={load} /> : null}
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="prices" activeTab={activeTab}>
        <UcatPlanPricesForm />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="discounts" activeTab={activeTab}>
        <UcatPracticeDayDiscountForm />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="quotas" activeTab={activeTab}>
        {config ? <UcatFreeQuotaConfigForm initial={config} onSaved={load} /> : null}
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="students" activeTab={activeTab}>
        <UcatFreeTierStudentsTable />
      </SegmentedTabPanelContent>
    </div>
  );
}
