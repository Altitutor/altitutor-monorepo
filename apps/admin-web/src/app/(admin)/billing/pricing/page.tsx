'use client';

import { useEffect, useState } from 'react';
import { PricingTable } from '@/features/billing/components/PricingTable';
import { pricingApi } from '@/features/billing/api/pricing';
import type { Tables } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';

export default function PricingPage() {
  const [subjects, setSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await pricingApi.getAllSubjectsWithPricing();
      setSubjects(data);
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
        <h1 className="text-2xl font-bold">Subject Pricing</h1>
        <p className="text-muted-foreground">
          Manage session fees and billing types for each subject
        </p>
      </div>
      <PricingTable subjects={subjects} onUpdate={loadData} />
    </div>
  );
}


