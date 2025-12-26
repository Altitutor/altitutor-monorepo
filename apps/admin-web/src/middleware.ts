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
        name: 'admin-auth',
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

  // Determine tutor app URL based on environment
  const tutorAppUrl = process.env.NODE_ENV === 'production' 
    ? 'https://tutor.altitutor.com'
    : 'http://localhost:3002';

  const isProtected = !pathname.startsWith('/login') && !pathname.startsWith('/forgot-password') && !pathname.startsWith('/reset-password') && !pathname.startsWith('/invite') && !pathname.startsWith('/auth') && pathname !== '/';
  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(new URL('/login', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  if (!user) return supabaseResponse;

  const { data: staff } = (await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()) as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  const role = staff?.role;

  // Only allow ADMINSTAFF - redirect TUTOR to tutor app
  if (role === 'TUTOR') {
    const redirectResponse = NextResponse.redirect(new URL(tutorAppUrl));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Block non-staff users
  if (!staff || role !== 'ADMINSTAFF') {
    const redirectResponse = NextResponse.redirect(new URL('/login?error=access_denied', origin));
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

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
