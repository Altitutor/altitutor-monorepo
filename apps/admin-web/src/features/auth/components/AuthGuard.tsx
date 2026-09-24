'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthSessionRecovery } from '@altitutor/shared/hooks';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { shouldRedirectAuthenticatedLogin } from '@/features/auth/utils/shouldRedirectAuthenticatedLogin';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/sentry-example-page'];

// Helper function to check if a path is public
const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthStore();
  const publicPath = isPublicPath(pathname);

  useAuthSessionRecovery({
    enabled: !publicPath,
    isLoading: loading,
    hasSession: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    const accessDenied =
      new URLSearchParams(window.location.search).get('error') === 'access_denied';
    if (shouldRedirectAuthenticatedLogin(pathname, accessDenied)) {
      router.replace('/dashboard');
    }
  }, [user, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // For public routes, always render
  if (publicPath) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated
  return user ? <>{children}</> : null;
}
