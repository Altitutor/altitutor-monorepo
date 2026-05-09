'use client';

import { Loader2 } from 'lucide-react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { TutorDashboardHome } from '@/features/dashboard';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: profile, isLoading } = useCurrentStaff();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = profile?.first_name ?? null;
  const staffId = profile?.id ?? null;

  return <TutorDashboardHome firstName={firstName} staffId={staffId} />;
}

