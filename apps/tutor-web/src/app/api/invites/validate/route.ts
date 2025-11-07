import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function GET(request: NextRequest) {
  try {
    console.log('[TUTOR INVITE VALIDATE] Route hit!');
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    console.log('[TUTOR INVITE VALIDATE] Token:', token);

    if (!token) {
      console.log('[TUTOR INVITE VALIDATE] No token provided');
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS (this is a public endpoint for invite validation)
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('[TUTOR INVITE VALIDATE] Supabase admin client created');

    // Check if token exists in staff table
    console.log('[TUTOR INVITE VALIDATE] Querying staff table...');
    const { data: staffMember, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, first_name, last_name, email, role, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    console.log('[TUTOR INVITE VALIDATE] Query result:', { staffMember, staffError });

    if (staffError) {
      console.error('[TUTOR INVITE VALIDATE] Error validating staff invite token:', staffError);
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (staffMember) {
      console.log('[TUTOR INVITE VALIDATE] Staff member found! Returning success');
      return NextResponse.json({
        valid: true,
        type: 'staff',
        data: {
          id: staffMember.id,
          first_name: staffMember.first_name,
          last_name: staffMember.last_name,
          email: staffMember.email,
          role: staffMember.role,
        }
      }, { status: 200 });
    }

    // If not found in staff, token is invalid for this endpoint
    console.log('[TUTOR INVITE VALIDATE] No staff member found with this token');
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired token' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Unexpected error validating invite token:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

