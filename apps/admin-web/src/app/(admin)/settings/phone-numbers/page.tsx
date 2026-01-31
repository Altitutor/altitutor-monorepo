'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneNumbersTable } from '@/features/phone-numbers';
import { phoneNumbersApi, type OwnedNumber } from '@/features/phone-numbers';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function PhoneNumbersPage() {
  const router = useRouter();
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
          <h1 className="text-3xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage phone numbers and set the default number for sending messages.
          </p>
        </div>
      </div>

      <PhoneNumbersTable numbers={numbers} onUpdate={loadData} />
    </div>
  );
}
