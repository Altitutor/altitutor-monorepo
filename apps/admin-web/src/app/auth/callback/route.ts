import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // IMPORTANT: do not strip maxAge/expires.
                // Supabase uses these to correctly rotate/clear chunked auth cookies.
                cookieStore.set(name, value, options)
              })
            } catch {
              // Called from Server Component
            }
          },
        },
        cookieOptions: {
          name: 'admin-auth',
          path: '/',
          sameSite: 'lax' as const,
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
        },
      }
    )
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Code exchange error:', error)
        // Redirect to error page with error message
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data.session) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Successfully exchanged code for session')
        }
        // For password reset flow, check if this is a recovery session
        const session = data.session
        const isRecoverySession = session.user?.recovery_sent_at || session.user?.email_change_sent_at
        
        if (isRecoverySession) {
          // This is a password reset flow - redirect to reset password page
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
        }
        
        // Determine role home based on staff.role
        try {
          const { data: staff } = await supabase
            .from('staff')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle<{ role: string }>();
          const role = staff?.role as 'ADMINSTAFF' | 'TUTOR' | undefined;
          
          // Redirect TUTOR to tutor app
          if (role === 'TUTOR') {
            const tutorAppUrl = process.env.NODE_ENV === 'production' 
              ? 'https://tutor.altitutor.com'
              : 'http://localhost:3002';
            return NextResponse.redirect(new URL(tutorAppUrl))
          }
          
          // Only allow ADMINSTAFF to proceed
          if (role !== 'ADMINSTAFF') {
            return NextResponse.redirect(new URL('/login?error=access_denied', requestUrl.origin))
          }
          
          const defaultHome = '/dashboard';
          const redirectUrl = next === '/' || next === '/dashboard' ? defaultHome : next;
          return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
        } catch (e) {
          // Fallback to dashboard on error
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
        }
      }
    } catch (err) {
      console.error('Unexpected error during code exchange:', err)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Authentication failed')}`, requestUrl.origin))
    }
  }

  // If no code, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=invalid_request', requestUrl.origin))
} 