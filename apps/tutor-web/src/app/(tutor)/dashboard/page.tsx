'use client';

import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { TutorDashboardHome, TutorDashboardPageSkeleton } from '@/features/dashboard';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: profile, isLoading } = useCurrentStaff();

  if (isLoading) {
    return <TutorDashboardPageSkeleton />;
  }

  const firstName = profile?.first_name ?? null;
  const staffId = profile?.id ?? null;

  return <TutorDashboardHome firstName={firstName} staffId={staffId} />;
}

