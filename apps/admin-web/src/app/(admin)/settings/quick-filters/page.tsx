'use client';

import { useEffect, useState } from 'react';
import { quickFiltersApi } from '@/features/quick-filters/api/quick-filters';
import { QuickFiltersTable } from '@/features/quick-filters/components/QuickFiltersTable';
import { Loader2, Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';
import type { QuickFilter } from '@altitutor/shared';

export default function QuickFiltersSettingsPage() {
  const [filters, setFilters] = useState<QuickFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createButtonClick, setCreateButtonClick] = useState(0);

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
      <SettingsPageHeader
        title="Quick Filters"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add Quick Filter"
            onClick={() => setCreateButtonClick((prev) => prev + 1)}
          />
        )}
      />

      <QuickFiltersTable filters={filters} onUpdate={loadData} onCreateTrigger={createButtonClick} />
    </div>
  );
}
