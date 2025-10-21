'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const { data: staff } = useCurrentStaff();

  useEffect(() => {
    if (!loading && user) {
      const role = staff?.role as 'ADMINSTAFF' | 'TUTOR' | undefined;
      const home = role === 'TUTOR' ? '/tutor/dashboard' : '/admin/dashboard';
      router.replace(home);
    }
  }, [loading, user, staff, router]);

  return null;
}