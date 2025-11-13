import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@altitutor/shared';

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[INVITE VALIDATE] Route hit!');
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    console.log('[INVITE VALIDATE] Token:', token);

    if (!token) {
      console.log('[INVITE VALIDATE] No token provided');
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
    console.log('[INVITE VALIDATE] Supabase admin client created');

    // Check if token exists in students table
    console.log('[INVITE VALIDATE] Querying students table...');
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, email, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    console.log('[INVITE VALIDATE] Query result:', { student, studentError });

    if (studentError) {
      console.error('[INVITE VALIDATE] Error validating student invite token:', studentError);
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (student) {
      console.log('[INVITE VALIDATE] Student found! Returning success');
      return NextResponse.json({
        valid: true,
        type: 'student',
        data: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
        }
      }, { status: 200 });
    }

    // If not found, token is invalid
    console.log('[INVITE VALIDATE] No student found with this token');
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

