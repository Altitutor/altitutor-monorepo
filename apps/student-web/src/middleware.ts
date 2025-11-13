import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@altitutor/shared';

export async function middleware(req: NextRequest) {
  const { pathname, origin } = new URL(req.url);

  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
      cookieOptions: {
        name: 'student-auth',
      },
    }
  );

  // IMPORTANT: Call getSession() to refresh session if needed
  // Note: Using getSession() in middleware is acceptable per Supabase docs
  // Middleware must be fast and can't call getUser() on every request
  // Client-side validation happens in AuthProvider
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // For API routes, we just refresh the session but don't redirect
  // The API route itself will handle auth checks
  if (pathname.startsWith('/api')) {
    return supabaseResponse;
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
    const redirectResponse = NextResponse.redirect(new URL('/login', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Allow public paths without further checks
  if (isPublicPath || !session) {
    return supabaseResponse;
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
      const redirectResponse = NextResponse.redirect(new URL('/admin/dashboard', adminPortalUrl));
      // Copy cookies from supabaseResponse to redirectResponse
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    } else if (role === 'TUTOR') {
      console.log('[STUDENT-WEB MIDDLEWARE] Staff member (TUTOR) detected, redirecting to tutor portal');
      const redirectResponse = NextResponse.redirect(new URL('/dashboard', tutorPortalUrl));
      // Copy cookies from supabaseResponse to redirectResponse
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
  }

  // If user is not a student, block access
  if (!student) {
    console.log('[STUDENT-WEB MIDDLEWARE] No student record found, redirecting to login with error');
    const redirectResponse = NextResponse.redirect(new URL('/login?error=access_denied', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Redirect root path to dashboard
  if (pathname === '/') {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // IMPORTANT: Return the supabaseResponse object to preserve cookie updates
  return supabaseResponse;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

