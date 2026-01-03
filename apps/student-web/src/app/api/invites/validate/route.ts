import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
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

    // Check if token exists in students table
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, email, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (studentError) {
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (student) {
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
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired token' },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

