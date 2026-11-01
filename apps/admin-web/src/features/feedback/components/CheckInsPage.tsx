"use client";
import { useFamilyCheckInsData } from '@/features/reconciliation/api/queries';
import { FamilyCheckInsTable } from '@/features/reconciliation/components/FamilyCheckInsTable';
import { SkeletonTable } from '@altitutor/ui';

export function CheckInsPage() {
  const query = useFamilyCheckInsData();
  if (query.isLoading) return <SkeletonTable rows={4} columns={4} />;
  if (query.isError) return <p role="alert">Unable to load check-ins. Please try again.</p>;
  const rows = [
    ...(query.data?.staff ?? []).map(row => ({ ...row, entity: 'staff' as const })),
    ...(query.data?.students ?? []).map(row => ({ ...row, entity: 'student' as const })),
    ...(query.data?.parents ?? []).map(row => ({ ...row, entity: 'parent' as const })),
  ];
  return <FamilyCheckInsTable title="Check-ins" entity="all" items={rows} />;
}
