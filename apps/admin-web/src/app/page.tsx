'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  useCurrentStaff(); // Prefetch staff data

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  return null;
}