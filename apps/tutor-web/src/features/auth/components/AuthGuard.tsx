'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/shared/lib/supabase/auth';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth', '/sentry-example-page'];

// Helper function to check if a path is public
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

  useEffect(() => {
    // Skip auth check for public paths
    if (isPublicPath(pathname)) {
      // If user is authenticated and trying to access login page, redirect to role home
      if (user && pathname === '/login') {
        // Let middleware/root handle precise role redirect; send to root
        router.push('/');
      }
      return;
    }

    // For protected routes
    if (!user && !loading) {
      const requestedPath = `${pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(requestedPath)}`);
    }
  }, [user, loading, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // For public routes, always render
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated
  return user ? <>{children}</> : null;
} 
