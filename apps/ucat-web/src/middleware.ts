import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@altitutor/shared'

export async function middleware(request: NextRequest) {
  const { pathname, origin } = new URL(request.url)

  let response = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
    cookieOptions: {
      name: 'student-auth',
    },
  })

  const publicPaths = ['/', '/login', '/signup', '/pricing', '/subscribe', '/subscribe/success']
  const isPublicPath =
    publicPaths.includes(pathname) ||
    pathname.startsWith('/subscribe') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/ucat/subscription-config'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectTo =
      request.nextUrl.searchParams.get('redirect')?.startsWith('/') === true
        ? request.nextUrl.searchParams.get('redirect')!
        : '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, origin))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
