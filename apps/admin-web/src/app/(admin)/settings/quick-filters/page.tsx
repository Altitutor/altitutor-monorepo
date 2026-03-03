'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { quickFiltersApi } from '@/features/quick-filters/api/quick-filters';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import type { QuickFilter } from '@altitutor/shared';

export default function QuickFiltersSettingsPage() {
  const router = useRouter();
  const [, setFilters] = useState<QuickFilter[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await quickFiltersApi.listAll();
      setFilters(data);
    } catch (error) {
      console.error('Failed to load quick filters:', error);
      alert('Failed to load quick filters: ' + (error as Error).message);
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
          <h1 className="text-3xl font-bold tracking-tight">Quick Filters</h1>
          <p className="text-muted-foreground">
            Manage global and personal quick filters for various entities.
          </p>
        </div>
      </div>
    </div>
  );
}
