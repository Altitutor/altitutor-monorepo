'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingSettingsTable } from '@/features/bookings/components/BookingSettingsTable';
import { bookingSettingsApi, type BookingSettingsRow } from '@/features/bookings/api/settings';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function BookingSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<BookingSettingsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await bookingSettingsApi.getBookingSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load booking settings:', error);
      alert('Failed to load booking settings: ' + (error as Error).message);
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
          <h1 className="text-2xl font-bold">Booking Settings</h1>
          <p className="text-muted-foreground">
            Manage global booking configuration settings
          </p>
        </div>
      </div>
      <BookingSettingsTable settings={settings} onUpdate={loadData} />
    </div>
  );
}
