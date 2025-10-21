import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

export async function middleware(req: NextRequest) {
  const { pathname, origin } = new URL(req.url);

  // Legacy redirects
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/admin/dashboard', origin));
  }
  if (pathname.startsWith('/dashboard/')) {
    const rest = pathname.replace('/dashboard', '');
    return NextResponse.redirect(new URL(`/admin/dashboard${rest}`, origin));
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/tutor') || pathname === '/';
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  if (!session) return res;

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const role = staff?.role as 'ADMINSTAFF' | 'TUTOR' | undefined;

  if (pathname === '/') {
    const home = role === 'TUTOR' ? '/tutor/dashboard' : '/admin/dashboard';
    return NextResponse.redirect(new URL(home, origin));
  }

  if (pathname.startsWith('/admin') && role === 'TUTOR') {
    return NextResponse.redirect(new URL('/tutor/dashboard', origin));
  }
  if (pathname.startsWith('/tutor') && role === 'ADMINSTAFF') {
    return NextResponse.redirect(new URL('/admin/dashboard', origin));
  }

  return res;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/tutor/:path*', '/dashboard', '/dashboard/:path*'],
};


