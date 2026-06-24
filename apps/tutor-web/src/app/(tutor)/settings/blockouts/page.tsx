'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BlockoutDatesTable } from '@/features/bookings/components/BlockoutDatesTable';
import { blockoutsApi, type BlockoutRow } from '@/features/bookings/api/blockouts';
import { ChevronLeft } from 'lucide-react';
import { Button, SkeletonPageHeader, SkeletonTable } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';

export default function BlockoutsPage() {
  const [blockouts, setBlockouts] = useState<BlockoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await blockoutsApi.getMyBlockouts();
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
    return (
      <TutorPageContainer className="space-y-6">
        <SkeletonPageHeader showBack />
        <SkeletonTable rows={6} columns={4} />
      </TutorPageContainer>
    );
  }

  return (
    <TutorPageContainer className="space-y-6">
      <header className="space-y-4">
        <Button asChild variant="outline" size="sm" className="w-fit rounded-xl shadow-sm">
          <Link href="/settings" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Settings
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blockout dates</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your unavailability dates and times
          </p>
        </div>
      </header>
      <BlockoutDatesTable blockouts={blockouts} onUpdate={loadData} />
    </TutorPageContainer>
  );
}

