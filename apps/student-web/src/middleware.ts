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
          cookiesToSet.forEach(({ name, value }) => {
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

  // For API routes, we just refresh the token but don't redirect
  // The API route itself will handle auth checks
  if (pathname.startsWith('/api')) {
    return supabaseResponse;
  }

  // Public paths that don't require authentication
  // Check these EARLY to avoid unnecessary auth calls
  const isPublicPath = 
    pathname === '/' ||
    pathname.startsWith('/login') || 
    pathname.startsWith('/forgot-password') || 
    pathname.startsWith('/reset-password') || 
    pathname.startsWith('/invite/') || 
    pathname.startsWith('/register/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/booking/trial-session') ||
    pathname.startsWith('/booking-success');

  // For public paths, allow access without authentication checks
  if (isPublicPath) {
    return supabaseResponse;
  }

  // IMPORTANT: Use getUser() to validate and refresh auth token
  // This validates the token with Supabase Auth server (secure)
  // getSession() reads from cookies without validation (insecure)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine portal URLs based on environment
  const adminPortalUrl = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'http://localhost:3000';
  const tutorPortalUrl = process.env.NEXT_PUBLIC_TUTOR_PORTAL_URL || 'http://localhost:3002';

  // If no user and trying to access protected route, redirect to login
  if (!user) {
    const redirectResponse = NextResponse.redirect(new URL('/login', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Check if user is a student using vstudent_profile view
  // This view is accessible to students (unlike the students table which has RLS blocking direct access)
  // The view automatically filters to the current user's record via current_student_id() function
  const { data: student, error: studentError } = await (supabase as any)
    .from('vstudent_profile')
    .select('id')
    .maybeSingle() as { data: { id: string } | null; error: any };

  if (studentError) {
    console.error('[STUDENT-WEB MIDDLEWARE] Error fetching student:', studentError);
  }

  // Check if user is staff (should not be on student portal)
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  if (staffError) {
    console.error('[STUDENT-WEB MIDDLEWARE] Error fetching staff:', staffError);
  }

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

