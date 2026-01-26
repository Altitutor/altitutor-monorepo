'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BillingPricingTable } from '@/features/billing/components/BillingPricingTable';
import { SubjectPricingOverridesTable } from '@/features/billing/components/SubjectPricingOverridesTable';
import { BillingSettingsTable } from '@/features/billing/components/BillingSettingsTable';
import { pricingApi, type BillingPricingRow } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi, type SubjectPricingOverrideRow } from '@/features/billing/api/subject-pricing-overrides';
import { billingSettingsApi, type BillingSettingsRow } from '@/features/billing/api/billing-settings';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@altitutor/ui';

export default function BillingSettingsPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState<BillingPricingRow[]>([]);
  const [overrides, setOverrides] = useState<SubjectPricingOverrideRow[]>([]);
  const [settings, setSettings] = useState<BillingSettingsRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPricing(), loadOverrides(), loadSettings()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
          <h1 className="text-3xl font-bold tracking-tight">Billing Settings</h1>
          <p className="text-muted-foreground">
            Manage billing pricing and subject-specific pricing overrides
          </p>
        </div>
      </div>

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList>
          <TabsTrigger value="pricing">Base Pricing</TabsTrigger>
          <TabsTrigger value="overrides">Subject Overrides</TabsTrigger>
          <TabsTrigger value="settings">Billing Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="pricing" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Base Billing Pricing</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Set default hourly rates for each billing type. These rates apply unless overridden by subject-specific pricing.
            </p>
            <BillingPricingTable pricing={pricing} onUpdate={loadPricing} />
          </div>
        </TabsContent>
        <TabsContent value="overrides" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Subject Pricing Overrides</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Override base pricing for specific subjects. Subject-specific rates take precedence over base pricing.
            </p>
            <SubjectPricingOverridesTable overrides={overrides} onUpdate={loadOverrides} />
          </div>
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Billing Settings</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage global billing configuration settings such as Stripe fee percentages and fixed fees.
            </p>
            <BillingSettingsTable settings={settings} onUpdate={loadSettings} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
