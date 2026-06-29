import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staffData, error: staffError } = await (supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{
            data: { role: string } | null;
            error: Error | null;
          }>;
        };
      };
    })
      .from('vtutor_profile')
      .select('role')
      .maybeSingle();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 }
      );
    }

    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev
      ? 'http://localhost:3002'
      : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
    const redirectUrl = `${baseUrl}/auth/callback`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Failed to generate password reset link:', error);
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
    console.error('Unexpected error generating password reset link:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
