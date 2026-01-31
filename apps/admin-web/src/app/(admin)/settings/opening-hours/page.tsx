'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpeningHoursTable } from '@/features/bookings/components/OpeningHoursTable';
import { openingHoursApi, type OpeningHoursRow } from '@/features/bookings/api/opening-hours';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function OpeningHoursPage() {
  const router = useRouter();
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
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Opening Hours</h1>
            <p className="text-muted-foreground">
              Manage business opening hours by day of the week
            </p>
          </div>
          <Button onClick={() => setAddButtonClick(prev => prev + 1)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Opening Hours
          </Button>
        </div>
      </div>
      <OpeningHoursTable openingHours={openingHours} onUpdate={loadData} onCreateTrigger={addButtonClick} />
    </div>
  );
}


