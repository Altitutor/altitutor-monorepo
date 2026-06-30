'use client';

import { useEffect, useState } from 'react';
import { BookingSettingsTable } from '@/features/bookings/components/BookingSettingsTable';
import { bookingSettingsApi, type BookingSettingsRow } from '@/features/bookings/api/settings';
import { Loader2 } from 'lucide-react';
import { SettingsPageHeader } from '@/shared/components';

export default function BookingSettingsPage() {
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
    <div className="p-6">
      <SettingsPageHeader title="Booking Settings" />
      <BookingSettingsTable settings={settings} onUpdate={loadData} />
    </div>
  );
}
