'use client';

import { useEffect, useState } from 'react';
import { OpeningHoursTable } from '@/features/bookings/components/OpeningHoursTable';
import { openingHoursApi, type OpeningHoursRow } from '@/features/bookings/api/opening-hours';
import { Loader2 } from 'lucide-react';

export default function OpeningHoursPage() {
  const [openingHours, setOpeningHours] = useState<OpeningHoursRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Opening Hours</h1>
        <p className="text-muted-foreground">
          Manage business opening hours by day of the week
        </p>
      </div>
      <OpeningHoursTable openingHours={openingHours} onUpdate={loadData} />
    </div>
  );
}

