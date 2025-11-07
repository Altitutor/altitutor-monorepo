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

  // Public paths that don't require authentication
  const isPublicPath = pathname.startsWith('/login') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password') || pathname.startsWith('/invite') || pathname.startsWith('/auth');
  
  // If no session and trying to access protected route, redirect to login
  const isProtected = pathname !== '/' && !isPublicPath;
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  // Allow public paths without session checks
  if (isPublicPath) {
    return res;
  }

  // If no session on public paths or root, allow access
  if (!session) return res;

  // Check if user is in staff table (both ADMINSTAFF and TUTOR allowed)
  const { data: staff, error: staffError } = (await supabase
    .from('staff')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()) as { data: { role: 'ADMINSTAFF' | 'TUTOR' } | null; error: any };

  if (staffError) {
    console.error('[TUTOR-WEB MIDDLEWARE] Error fetching staff:', staffError);
  }

  console.log('[TUTOR-WEB MIDDLEWARE]', {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    staffFound: !!staff,
    staffRole: staff?.role,
  });

  // Block students - if not in staff table, redirect to login
  if (!staff) {
    console.log('[TUTOR-WEB MIDDLEWARE] No staff record found, redirecting to login');
    return NextResponse.redirect(new URL('/login?error=access_denied', origin));
  }

  const role = staff.role;

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', origin));
  }

  return res;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

