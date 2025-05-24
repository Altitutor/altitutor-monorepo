import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/lib/supabase/db/types'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Code exchange error:', error)
        // Redirect to error page with error message
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }

      if (data.session) {
        console.log('Successfully exchanged code for session')
        // For password reset flow, check if this is a recovery session
        const session = data.session
        const isRecoverySession = session.user?.recovery_sent_at || session.user?.email_change_sent_at
        
        if (isRecoverySession) {
          // This is a password reset flow - redirect to reset password page
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
        }
        
        // For other auth flows, redirect to the next URL or dashboard
        const redirectUrl = next === '/' ? '/dashboard' : next
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