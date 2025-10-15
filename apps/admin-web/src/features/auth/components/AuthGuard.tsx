'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/shared/lib/supabase/auth';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    // Skip auth check for public paths
    if (PUBLIC_PATHS.includes(pathname)) {
      // If user is authenticated and trying to access login page, redirect to dashboard
      if (user && pathname === '/login') {
        router.push('/dashboard');
      }
      // We don't redirect from reset-password even if authenticated
      return;
    }

    // For protected routes
    if (!user && !loading) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // For public routes, always render
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated
  return user ? <>{children}</> : null;
} 