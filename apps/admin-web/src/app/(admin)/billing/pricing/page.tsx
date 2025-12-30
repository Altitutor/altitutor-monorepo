'use client';

import { useEffect, useState } from 'react';
import { PricingTable } from '@/features/billing/components/PricingTable';
import { pricingApi, type BillingPricingRow } from '@/features/billing/api/pricing';
import { Loader2 } from 'lucide-react';

export default function PricingPage() {
  const [pricing, setPricing] = useState<BillingPricingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await pricingApi.getBillingPricing();
      setPricing(data);
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
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Billing Pricing</h1>
        <p className="text-muted-foreground">
          Manage hourly rates for each billing type (CLASS, EXAM_COURSE, DRAFTING)
        </p>
      </div>
      <PricingTable pricing={pricing} onUpdate={loadData} />
    </div>
  );
}
