'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpeningHoursTable } from '@/features/bookings/components/OpeningHoursTable';
import { openingHoursApi, type OpeningHoursRow } from '@/features/bookings/api/opening-hours';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function OpeningHoursPage() {
  const router = useRouter();
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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Opening Hours</h1>
          <p className="text-muted-foreground">
            Manage business opening hours by day of the week
          </p>
        </div>
      </div>
      <OpeningHoursTable openingHours={openingHours} onUpdate={loadData} />
    </div>
  );
}


