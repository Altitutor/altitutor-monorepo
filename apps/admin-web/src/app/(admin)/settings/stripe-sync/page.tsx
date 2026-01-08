'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { StripeSyncTable } from '@/features/stripe-sync/components/StripeSyncTable';
import { stripeSyncApi } from '@/features/stripe-sync/api/stripe-sync';
import { Loader2 } from 'lucide-react';

export default function StripeSyncPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch students with Stripe info
  const {
    data: students,
    isLoading: loadingStudents,
    isFetching: fetchingStudents,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['stripe-sync-students', refreshKey],
    queryFn: stripeSyncApi.getStudentsWithStripe,
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    refetchStudents();
  };

  const isLoading = loadingStudents;
  const isFetching = fetchingStudents;

  return (
    <div className="p-6 space-y-6">
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
          <h1 className="text-3xl font-bold tracking-tight">Stripe Sync</h1>
          <p className="text-muted-foreground mt-1">
            Sync Stripe customers to students and manage payment methods
          </p>
        </div>
      </div>

      <StripeSyncTable
        students={students || []}
        isLoading={isLoading}
        isFetching={isFetching}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

