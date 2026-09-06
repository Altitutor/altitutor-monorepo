'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthSessionRecovery } from '@altitutor/shared/hooks';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { shouldRedirectAuthenticatedLogin } from '@/features/auth/utils/shouldRedirectAuthenticatedLogin';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth', '/sentry-example-page'];

const isPublicPath = (pathname: string): boolean => {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/form/')
  );
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
      router.push('/');
    }
  }, [user, pathname, router]);

  if (loading) {
    return null;
  }

  if (publicPath) {
    return children;
  }

  return user ? children : null;
}
