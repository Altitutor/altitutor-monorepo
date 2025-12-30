'use client';

import { useEffect, useState } from 'react';
import { SubjectPricingOverridesTable } from '@/features/billing/components/SubjectPricingOverridesTable';
import { subjectPricingOverridesApi, type SubjectPricingOverrideRow } from '@/features/billing/api/subject-pricing-overrides';
import { Loader2 } from 'lucide-react';

export default function SubjectOverridesPage() {
  const [overrides, setOverrides] = useState<SubjectPricingOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await subjectPricingOverridesApi.getAllSubjectOverrides();
      setOverrides(data);
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
        <h1 className="text-2xl font-bold">Subject Pricing Overrides</h1>
        <p className="text-muted-foreground">
          Manage subject-specific hourly rate overrides. These override the default billing type rates for specific subjects.
        </p>
      </div>
      <SubjectPricingOverridesTable overrides={overrides} onUpdate={loadData} />
    </div>
  );
}

