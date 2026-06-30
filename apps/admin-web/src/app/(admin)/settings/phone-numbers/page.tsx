'use client';

import { useEffect, useState } from 'react';
import { PhoneNumbersTable } from '@/features/phone-numbers';
import { phoneNumbersApi, type OwnedNumber } from '@/features/phone-numbers';
import { AdminLoadingSkeleton, SettingsPageHeader } from '@/shared/components';

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const numbersData = await phoneNumbersApi.getOwnedNumbers();
      setNumbers(numbersData);
    } catch (error) {
      console.error('Failed to load phone numbers:', error);
      alert('Failed to load phone numbers: ' + (error as Error).message);
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
      <SettingsPageHeader title="Phone Numbers" />

      <PhoneNumbersTable numbers={numbers} onUpdate={loadData} />
    </div>
  );
}
