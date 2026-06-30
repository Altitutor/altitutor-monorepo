'use client';

import { useEffect, useState, useCallback } from 'react';
import { BillingPricingTable } from '@/features/billing/components/BillingPricingTable';
import { SubjectPricingOverridesTable } from '@/features/billing/components/SubjectPricingOverridesTable';
import { BillingSettingsTable } from '@/features/billing/components/BillingSettingsTable';
import { pricingApi, type BillingPricingRow } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi, type SubjectPricingOverrideRow } from '@/features/billing/api/subject-pricing-overrides';
import { billingSettingsApi, type BillingSettingsRow } from '@/features/billing/api/billing-settings';
import { Loader2, Plus } from 'lucide-react';
import { SegmentedTabPanel, SegmentedTabPanelContent } from '@altitutor/ui';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export default function BillingSettingsPage() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [pricing, setPricing] = useState<BillingPricingRow[]>([]);
  const [overrides, setOverrides] = useState<SubjectPricingOverrideRow[]>([]);
  const [settings, setSettings] = useState<BillingSettingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOverrideClick, setCreateOverrideClick] = useState(0);

  const loadPricing = async () => {
    try {
      const data = await pricingApi.getBillingPricing();
      setPricing(data);
    } catch (error) {
      console.error('Failed to load billing pricing:', error);
      alert('Failed to load billing pricing: ' + (error as Error).message);
    }
  };

  const loadOverrides = async () => {
    try {
      const data = await subjectPricingOverridesApi.getAllSubjectOverrides();
      setOverrides(data);
    } catch (error) {
      console.error('Failed to load pricing overrides:', error);
      alert('Failed to load pricing overrides: ' + (error as Error).message);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await billingSettingsApi.getBillingSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load billing settings:', error);
      alert('Failed to load billing settings: ' + (error as Error).message);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPricing(), loadOverrides(), loadSettings()]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Billing Settings"
        actions={activeTab === 'overrides' ? (
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Create Override"
            onClick={() => setCreateOverrideClick((prev) => prev + 1)}
          />
        ) : undefined}
      />

      <SegmentedTabPanel
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
        options={[
          { value: 'pricing', label: 'Base Pricing' },
          { value: 'overrides', label: 'Subject Overrides' },
          { value: 'settings', label: 'Billing Settings' },
        ]}
      >
        <SegmentedTabPanelContent when="pricing" activeTab={activeTab} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Base Billing Pricing</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Set default hourly rates for each billing type. These rates apply unless overridden by subject-specific pricing.
            </p>
            <BillingPricingTable pricing={pricing} onUpdate={loadPricing} />
          </div>
        </SegmentedTabPanelContent>
        <SegmentedTabPanelContent when="overrides" activeTab={activeTab} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Subject Pricing Overrides</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Override base pricing for specific subjects. Subject-specific rates take precedence over base pricing.
            </p>
            <SubjectPricingOverridesTable
              overrides={overrides}
              onUpdate={loadOverrides}
              onCreateTrigger={createOverrideClick}
            />
          </div>
        </SegmentedTabPanelContent>
        <SegmentedTabPanelContent when="settings" activeTab={activeTab} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Billing Settings</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage global billing configuration settings such as Stripe fee percentages and fixed fees.
            </p>
            <BillingSettingsTable settings={settings} onUpdate={loadSettings} />
          </div>
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>
    </div>
  );
}
