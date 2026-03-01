'use client';

import { Loader2 } from 'lucide-react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { UcatPagePlaceholder } from '@altitutor/ui';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: profile, isLoading } = useCurrentStaff();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || null;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {firstName || 'Tutor'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and view your classes
        </p>
      </div>

      <UcatPagePlaceholder
        title="UCAT System"
        description="Shared ALTI-318 UI components are available for tutor-web and ucat-web."
      />

      {/* Future: Add more dashboard cards for sessions, attendance, etc. */}
    </div>
  );
}

