'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthSessionRecovery } from '@altitutor/shared/hooks';
import { useAuthStore } from '@/shared/lib/supabase/auth';

// Auth pages that authenticated users should be redirected away from
const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password'];

// Helper function to check if a path is an auth page
const isAuthPage = (pathname: string): boolean => {
  return AUTH_PAGES.includes(pathname) || pathname.startsWith('/auth/');
};

const isPublicPath = (pathname: string): boolean =>
  isAuthPage(pathname) ||
  pathname.startsWith('/invite/') ||
  pathname.startsWith('/register/') ||
  pathname.startsWith('/r/') ||
  pathname.startsWith('/b/') ||
  pathname.startsWith('/form/') ||
  pathname.startsWith('/booking/trial-session') ||
  pathname.startsWith('/booking-success') ||
  pathname.startsWith('/sentry-example-page');

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthStore();

  useAuthSessionRecovery({
    enabled: !isPublicPath(pathname),
    isLoading: loading,
    hasSession: Boolean(user),
  });

  useEffect(() => {
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    // Middleware already handles redirecting unauthenticated users from protected routes,
    // so we only need to handle this UX improvement here
    if (user && isAuthPage(pathname) && pathname !== '/reset-password' && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // Middleware has already handled all route protection, so we can always render children
  return <>{children}</>;
} 
