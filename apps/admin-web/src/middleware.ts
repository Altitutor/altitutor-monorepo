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

  // Determine tutor app URL based on environment
  const tutorAppUrl = process.env.NODE_ENV === 'production' 
    ? 'https://tutor.altitutor.com'
    : 'http://localhost:3002';

  const isProtected = !pathname.startsWith('/login') && !pathname.startsWith('/forgot-password') && !pathname.startsWith('/reset-password') && !pathname.startsWith('/invite') && !pathname.startsWith('/auth') && pathname !== '/';
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  if (!session) return res;

  const { data: staff } = (await supabase
    .from('staff')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()) as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  const role = staff?.role;

  // Only allow ADMINSTAFF - redirect TUTOR to tutor app
  if (role === 'TUTOR') {
    return NextResponse.redirect(new URL(tutorAppUrl));
  }

  // Block non-staff users
  if (!staff || role !== 'ADMINSTAFF') {
    return NextResponse.redirect(new URL('/login?error=access_denied', origin));
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', origin));
  }

  return res;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
