'use client';

import { useEffect, useState } from 'react';
import { BlockoutDatesTable } from '@/features/bookings/components/BlockoutDatesTable';
import { blockoutsApi, type BlockoutRow } from '@/features/bookings/api/blockouts';
import { Plus } from 'lucide-react';
import { AdminLoadingSkeleton, AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export default function BlockoutsPage() {
  const [blockouts, setBlockouts] = useState<BlockoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addButtonClick, setAddButtonClick] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await blockoutsApi.getBlockouts();
      setBlockouts(data);
    } catch (error) {
      console.error('Failed to load blockouts:', error);
      alert('Failed to load blockouts: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Blockout Dates"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add Blockout"
            onClick={() => setAddButtonClick(prev => prev + 1)}
          />
        )}
      />
      <BlockoutDatesTable blockouts={blockouts} onUpdate={loadData} onCreateTrigger={addButtonClick} />
    </div>
  );
}
