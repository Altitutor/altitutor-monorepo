import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

export async function middleware(req: NextRequest) {
  const { pathname, origin } = new URL(req.url);

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // For API routes, we just refresh the session but don't redirect
  // The API route itself will handle auth checks
  if (pathname.startsWith('/api')) {
    return res;
  }

  // Determine portal URLs based on environment
  const adminPortalUrl = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'http://localhost:3000';
  const tutorPortalUrl = process.env.NEXT_PUBLIC_TUTOR_PORTAL_URL || 'http://localhost:3002';

  // Public paths that don't require authentication
  const isPublicPath = 
    pathname === '/' ||
    pathname.startsWith('/login') || 
    pathname.startsWith('/forgot-password') || 
    pathname.startsWith('/reset-password') || 
    pathname.startsWith('/invite/') || 
    pathname.startsWith('/auth/');

  // If no session and trying to access protected route, redirect to login
  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  // Allow public paths without further checks
  if (isPublicPath || !session) {
    return res;
  }

  // Check if user is a student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (studentError) {
    console.error('[STUDENT-WEB MIDDLEWARE] Error fetching student:', studentError);
  }

  // Check if user is staff (should not be on student portal)
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle() as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  if (staffError) {
    console.error('[STUDENT-WEB MIDDLEWARE] Error fetching staff:', staffError);
  }

  console.log('[STUDENT-WEB MIDDLEWARE]', {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    isStudent: !!student,
    isStaff: !!staff,
    staffRole: staff?.role,
  });

  // If user is staff, redirect them to appropriate portal
  if (staff) {
    const role = staff.role;
    if (role === 'ADMINSTAFF') {
      console.log('[STUDENT-WEB MIDDLEWARE] Staff member (ADMINSTAFF) detected, redirecting to admin portal');
      return NextResponse.redirect(new URL('/admin/dashboard', adminPortalUrl));
    } else if (role === 'TUTOR') {
      console.log('[STUDENT-WEB MIDDLEWARE] Staff member (TUTOR) detected, redirecting to tutor portal');
      return NextResponse.redirect(new URL('/dashboard', tutorPortalUrl));
    }
  }

  // If user is not a student, block access
  if (!student) {
    console.log('[STUDENT-WEB MIDDLEWARE] No student record found, redirecting to login with error');
    return NextResponse.redirect(new URL('/login?error=access_denied', origin));
  }

  // Redirect root path to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', origin));
  }

  return res;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

