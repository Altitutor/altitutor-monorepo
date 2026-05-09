'use client';

import { Loader2 } from 'lucide-react';
import { useProfile } from '@/features/profile';
import { StudentDashboardHome } from '@/features/dashboard';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name ?? null;

  return <StudentDashboardHome firstName={firstName} />;
}


