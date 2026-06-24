'use client';

import { useProfile } from '@/features/profile';
import { StudentDashboardHome, StudentDashboardPageSkeleton } from '@/features/dashboard';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return <StudentDashboardPageSkeleton />;
  }

  const firstName = profile?.first_name ?? null;

  return <StudentDashboardHome firstName={firstName} />;
}


