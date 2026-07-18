import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single<{ role: string }>();

    if (staffError || !staffData || (staffData.role !== 'ADMINSTAFF' && staffData.role !== 'OFFICE_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Verify admin client is available
    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, email, userType } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email' },
        { status: 400 }
      );
    }

    // Determine redirect URL based on user type
    let redirectUrl: string;
    const isDev = process.env.NODE_ENV === 'development';
    
    if (userType === 'student') {
      const baseUrl = isDev 
        ? 'http://localhost:3001'
        : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
      redirectUrl = `${baseUrl}/auth/callback`;
    } else if (userType === 'tutor') {
      const baseUrl = isDev
        ? 'http://localhost:3002'
        : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
      redirectUrl = `${baseUrl}/auth/callback`;
    } else {
      // Admin/staff
      const baseUrl = isDev
        ? 'http://localhost:3000'
        : (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.altitutor.com');
      redirectUrl = `${baseUrl}/auth/callback`;
    }

    // Generate the token with Supabase, then expose an app-owned callback link.
    // The raw action_link points at /auth/v1/verify and can fall back to PKCE
    // same-browser behavior after redirect. token_hash + verifyOtp works from
    // copied links and text messages.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Failed to generate password reset link:', error);
      captureApiError(error, "/api/generate-password-reset-link");
      return NextResponse.json(
        { error: `Failed to generate password reset link: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data?.properties?.hashed_token) {
      return NextResponse.json(
        { error: 'Password reset link generated but no token hash returned' },
        { status: 500 }
      );
    }

    const link = new URL(redirectUrl);
    link.searchParams.set('token_hash', data.properties.hashed_token);
    link.searchParams.set('type', 'recovery');

    return NextResponse.json({
      link: link.toString(),
    }, { status: 200 });
  } catch (error) {
    captureApiError(error, "/api/generate-password-reset-link");
    console.error('Unexpected error generating password reset link:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
