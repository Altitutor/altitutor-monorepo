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
        name: 'tutor-auth',
      },
    }
  );

  // IMPORTANT: Use getUser() to validate and refresh auth token
  // This validates the token with Supabase Auth server (secure)
  // getSession() reads from cookies without validation (insecure)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // For API routes, we just refresh the token but don't redirect
  // The API route itself will handle auth checks
  if (pathname.startsWith('/api')) {
    return supabaseResponse;
  }

  // Public paths that don't require authentication
  const isPublicPath = pathname.startsWith('/login') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password') || pathname.startsWith('/invite') || pathname.startsWith('/auth');
  
  // If no user and trying to access protected route, redirect to login
  const isProtected = pathname !== '/' && !isPublicPath;
  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(new URL('/login', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Allow public paths without user checks
  if (isPublicPath) {
    return supabaseResponse;
  }

  // If no user on public paths or root, allow access
  if (!user) return supabaseResponse;

  // Check if user is in staff table (both ADMINSTAFF and TUTOR allowed)
  const { data: staff, error: staffError } = (await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  if (staffError) {
    console.error('[TUTOR-WEB MIDDLEWARE] Error fetching staff:', staffError);
  }

  console.log('[TUTOR-WEB MIDDLEWARE]', {
    pathname,
    hasUser: !!user,
    userId: user?.id,
    staffFound: !!staff,
    staffRole: staff?.role,
  });

  // Block students - if not in staff table, redirect to login
  if (!staff) {
    console.log('[TUTOR-WEB MIDDLEWARE] No staff record found, redirecting to login');
    const redirectResponse = NextResponse.redirect(new URL('/login?error=access_denied', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  const role = staff.role;

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

