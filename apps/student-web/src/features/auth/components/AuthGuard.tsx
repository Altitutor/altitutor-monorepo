'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/reset-password'];
const ADMIN_PORTAL_URL = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'http://localhost:3000';

// Helper function to check if a path is public
const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuthStore();
  const [roleChecking, setRoleChecking] = useState(false);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user || loading) return;
      
      setRoleChecking(true);
      
      try {
        console.log('[AuthGuard] Checking role for user:', user.id);
        
        // Check if user is a student
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[AuthGuard] Student query result:', { studentData, studentError });

        if (studentData) {
          console.log('[AuthGuard] User is a student');
          setIsStudent(true);
          setRoleChecking(false);
          return;
        }

        // Check if user is staff
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('id, role')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[AuthGuard] Staff query result:', { staffData, staffError });

        if (staffData) {
          // User is staff, redirect to admin portal
          console.log('[AuthGuard] User is staff, redirecting to admin portal');
          setIsStudent(false);
          setRoleChecking(false);
          
          // Redirect to admin portal
          window.location.href = `${ADMIN_PORTAL_URL}/admin/dashboard`;
          return;
        }

        // User exists in auth but not in students or staff tables
        // This shouldn't happen, but handle it gracefully
        console.log('[AuthGuard] User not found in students or staff tables');
        setIsStudent(false);
        setRoleChecking(false);
      } catch (error) {
        console.error('Error checking user role:', error);
        setRoleChecking(false);
      }
    };

    if (user && !isPublicPath(pathname)) {
      checkUserRole();
    }
  }, [user, loading, pathname, supabase]);

  useEffect(() => {
    // Skip auth check for public paths
    if (isPublicPath(pathname)) {
      // If user is authenticated and trying to access login page, redirect to dashboard
      if (user && pathname === '/login' && !roleChecking) {
        router.push('/dashboard');
      }
      return;
    }

    // For protected routes
    if (!user && !loading) {
      router.push('/login');
    }
  }, [user, loading, pathname, router, roleChecking]);

  // Show nothing while checking auth or role
  if (loading || roleChecking) {
    return null;
  }

  // For public routes, always render
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated and is a student
  if (user && isStudent === false) {
    // Staff member trying to access student portal - show message while redirecting
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">Redirecting to admin portal...</p>
          <p className="text-sm text-muted-foreground">Staff members should use the admin portal.</p>
        </div>
      </div>
    );
  }

  // For protected routes, only render if authenticated and is a student
  return user && isStudent ? <>{children}</> : null;
} 