'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { StripeSyncTable } from '@/features/stripe-sync/components/StripeSyncTable';
import { stripeSyncApi } from '@/features/stripe-sync/api/stripe-sync';

export default function StripeSyncPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const initialStudentId = searchParams.get('studentId');

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
          <h1 className="text-3xl font-bold tracking-tight">Stripe Sync</h1>
          <p className="text-muted-foreground">
            Sync Stripe customers to students and manage payment methods
          </p>
        </div>
      </div>

      <StripeSyncTable
        students={students || []}
        isLoading={isLoading}
        isFetching={isFetching}
        onRefresh={handleRefresh}
        initialStudentId={initialStudentId}
      />
    </div>
  );
}

