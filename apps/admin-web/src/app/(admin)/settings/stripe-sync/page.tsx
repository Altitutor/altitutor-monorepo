'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { StripeSyncTable } from '@/features/stripe-sync/components/StripeSyncTable';
import { stripeSyncApi } from '@/features/stripe-sync/api/stripe-sync';
import { SettingsPageHeader } from '@/shared/components';

export default function StripeSyncPage() {
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
      <SettingsPageHeader title="Stripe Sync" />

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
