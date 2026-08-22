import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code || tokenHash) {
    const cookieStore = await cookies()
    const supabase = instrumentSupabaseClient(createServerClient<Database>(
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
                cookieStore.set(name, value, options)
              })
            } catch {
              // Called from Server Component
            }
          },
        },
        cookieOptions: {
          name: 'student-auth',
        },
      }
    ))
    
    try {
      const { data, error } = tokenHash
        ? await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === 'recovery' ? 'recovery' : 'email',
          })
        : await supabase.auth.exchangeCodeForSession(code!)
      
      if (error) {
        console.error('Code exchange error:', error)
        const errorPath = type === 'recovery' ? '/forgot-password' : '/login'
        return NextResponse.redirect(new URL(`${errorPath}?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data.session) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Successfully exchanged code for session')
        }
        // For password reset flow, check if this is a recovery session
        const session = data.session
        const isRecoverySession = type === 'recovery' || session.user?.recovery_sent_at || session.user?.email_change_sent_at
        
        if (isRecoverySession) {
          // This is a password reset flow - redirect to reset password page
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
        }
        
        // For other auth flows, redirect to the next URL or home
        const redirectUrl = next
        return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
      }
    } catch (err) {
      console.error('Unexpected error during code exchange:', err)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Authentication failed')}`, requestUrl.origin))
    }
  }

  // If no code, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=invalid_request', requestUrl.origin))
} 
