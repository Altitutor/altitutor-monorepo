import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@altitutor/shared';

const MIDDLEWARE_DEADLINE_MS = 10_000;
const RETRY_AFTER_SECONDS = 5;

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

class MiddlewareDeadlineError extends Error {
  constructor() {
    super('Admin middleware dependency deadline exceeded');
    this.name = 'MiddlewareDeadlineError';
  }
}

function createInvocationDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new MiddlewareDeadlineError());
    }, MIDDLEWARE_DEADLINE_MS);
  });

  return {
    async fetch(input: RequestInfo | URL, init: RequestInit = {}) {
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      const signals = [controller.signal, init.signal].filter(
        (signal): signal is AbortSignal => Boolean(signal)
      );
      signals.forEach((signal) => {
        if (signal.aborted) abortRequest();
        else signal.addEventListener('abort', abortRequest, { once: true });
      });

      try {
        return await fetch(input, { ...init, signal: requestController.signal });
      } finally {
        signals.forEach((signal) => signal.removeEventListener('abort', abortRequest));
      }
    },
    race<T>(operation: PromiseLike<T>) {
      return Promise.race([Promise.resolve(operation), expiration]);
    },
    dispose() {
      clearTimeout(timeout);
    },
  };
}

function applyResponseMetadata(response: NextResponse, cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function unavailableResponse(cookies: CookieToSet[]) {
  const response = new NextResponse(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporarily unavailable</title></head><body><main><h1>Temporarily unavailable</h1><p>Admin services are taking too long to respond. Please try again in a moment.</p></main></body></html>',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': String(RETRY_AFTER_SECONDS),
      },
    }
  );
  return applyResponseMetadata(response, cookies);
}

export async function middleware(req: NextRequest) {
  const { pathname, origin } = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return NextResponse.next({ request: req });
  }

  if (pathname.startsWith('/auth/callback&')) {
    const redirectUrl = new URL(req.url);
    redirectUrl.pathname = '/auth/callback';
    redirectUrl.search = pathname.slice('/auth/callback&'.length);
    return NextResponse.redirect(redirectUrl);
  }

  // API routes perform their own authorization and do not need page routing logic.
  if (pathname.startsWith('/api')) {
    return NextResponse.next({
      request: req,
    });
  }

  // Public paths that don't require authentication checks.
  // IMPORTANT: avoid calling supabase.auth.getUser() on public paths (e.g. /login) because
  // background/prefetch requests that arrive without cookies can cause Supabase to "clear"
  // cookies (Set-Cookie with empty chunks), breaking the real authenticated navigation.
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/sentry-example-page');

  if (isPublicPath) {
    return NextResponse.next({
      request: req,
    });
  }

  let supabaseResponse = NextResponse.next({
    request: req,
  });
  const cookiesToSet: CookieToSet[] = [];
  const deadline = createInvocationDeadline();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(updatedCookies) {
          updatedCookies.forEach((cookie) => {
            const { name, value } = cookie;
            req.cookies.set(name, value);
            const existingIndex = cookiesToSet.findIndex(
              (existing) => existing.name === name
            );
            if (existingIndex >= 0) {
              cookiesToSet[existingIndex] = cookie;
            } else {
              cookiesToSet.push(cookie);
            }
          });
          supabaseResponse = NextResponse.next({
            request: req,
          });
          applyResponseMetadata(supabaseResponse, cookiesToSet);
        },
      },
      cookieOptions: {
        name: 'admin-auth',
        path: '/',
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
      },
      global: {
        fetch: deadline.fetch,
      },
    }
  );

  // Determine tutor app URL based on environment
  const tutorAppUrl = process.env.NODE_ENV === 'production' 
    ? 'https://tutor.altitutor.com'
    : 'http://localhost:3002';

  try {
    let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claimsResult = await deadline.race(supabase.auth.getClaims());
    } catch (error) {
      console.error('Admin middleware authentication dependency failed', error);
      return unavailableResponse(cookiesToSet);
    }

    const { data: claimsData, error: claimsError } = claimsResult;
    const isMissingSession = claimsError?.name === 'AuthSessionMissingError';

    if (claimsError && !isMissingSession) {
      console.error('Admin middleware authentication dependency failed', claimsError);
      return unavailableResponse(cookiesToSet);
    }

    const userId = claimsData?.claims?.sub;

    const isProtected = pathname !== '/';
    if (!userId && isProtected) {
      const redirectResponse = NextResponse.redirect(new URL('/login', origin));
      return applyResponseMetadata(redirectResponse, cookiesToSet);
    }

    if (!userId) return applyResponseMetadata(supabaseResponse, cookiesToSet);

    let adminResult: Awaited<ReturnType<typeof supabase.rpc<'is_adminstaff_active'>>>;
    try {
      adminResult = await deadline.race(supabase.rpc('is_adminstaff_active'));
    } catch (error) {
      console.error('Admin middleware admin-role dependency failed', error);
      return unavailableResponse(cookiesToSet);
    }

    if (adminResult.error) {
      console.error('Admin middleware admin-role dependency failed', adminResult.error);
      return unavailableResponse(cookiesToSet);
    }

    const isAdmin = adminResult.data === true;

    type TutorResult = {
      data: Pick<Database['public']['Views']['vtutor_profile']['Row'], 'id' | 'role' | 'status'> | null;
      error: { message: string } | null;
    };

    if (!isAdmin) {
      let tutorResult: TutorResult;
      try {
        tutorResult = (await deadline.race(
          supabase
            .from('vtutor_profile')
            .select('id, role, status')
            .maybeSingle()
        )) as TutorResult;
      } catch (error) {
        console.error('Admin middleware tutor dependency failed', error);
        return unavailableResponse(cookiesToSet);
      }

      if (tutorResult.error) {
        console.error('Admin middleware tutor dependency failed', tutorResult.error);
        return unavailableResponse(cookiesToSet);
      }

      if (tutorResult.data?.role === 'TUTOR' && tutorResult.data.status === 'ACTIVE') {
        const redirectResponse = NextResponse.redirect(new URL(tutorAppUrl));
        return applyResponseMetadata(redirectResponse, cookiesToSet);
      }

      const redirectResponse = NextResponse.redirect(new URL('/login?error=access_denied', origin));
      return applyResponseMetadata(redirectResponse, cookiesToSet);
    }

    if (pathname === '/') {
      const redirectResponse = NextResponse.redirect(new URL('/dashboard', origin));
      return applyResponseMetadata(redirectResponse, cookiesToSet);
    }

    // IMPORTANT: Return the supabaseResponse object to preserve cookie updates
    return applyResponseMetadata(supabaseResponse, cookiesToSet);
  } finally {
    deadline.dispose();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2)$).*)',
  ],
};
