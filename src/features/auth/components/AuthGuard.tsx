'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuthStore();

  useEffect(() => {
    // Skip auth check for public paths
    if (PUBLIC_PATHS.includes(pathname)) {
      // If user is authenticated and trying to access login page, redirect to dashboard
      if (isAuthenticated && pathname === '/login') {
        router.push('/dashboard');
      }
      // We don't redirect from reset-password even if authenticated
      return;
    }

    // For protected routes
    if (!isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // For public routes, always render
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated
  return isAuthenticated ? <>{children}</> : null;
} 