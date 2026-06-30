'use client';

import { useEffect, useState } from 'react';
import { OpeningHoursTable } from '@/features/bookings/components/OpeningHoursTable';
import { openingHoursApi, type OpeningHoursRow } from '@/features/bookings/api/opening-hours';
import { Loader2, Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export default function OpeningHoursPage() {
  const [openingHours, setOpeningHours] = useState<OpeningHoursRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addButtonClick, setAddButtonClick] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await openingHoursApi.getOpeningHours();
      setOpeningHours(data);
    } catch (error) {
      console.error('Failed to load opening hours:', error);
      alert('Failed to load opening hours: ' + (error as Error).message);
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
        title="Opening Hours"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add Opening Hours"
            onClick={() => setAddButtonClick(prev => prev + 1)}
          />
        )}
      />
      <OpeningHoursTable openingHours={openingHours} onUpdate={loadData} onCreateTrigger={addButtonClick} />
    </div>
  );
}
