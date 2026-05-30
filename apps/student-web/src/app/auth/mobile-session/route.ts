import type { Database } from '@altitutor/shared';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const refreshToken = request.headers.get('x-student-refresh-token');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
      cookieOptions: {
        name: 'student-auth',
      },
    },
  );

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
  }

  return NextResponse.redirect(new URL('/billing', request.url), 303);
}
