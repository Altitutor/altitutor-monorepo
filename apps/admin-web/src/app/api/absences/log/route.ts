import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operations, staffId } = body;

    // Validate required fields
    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json(
        { error: 'operations array is required' },
        { status: 400 }
      );
    }

    if (!staffId) {
      return NextResponse.json(
        { error: 'staffId is required' },
        { status: 400 }
      );
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Call the RPC function
    const { data, error } = await supabase.rpc('log_student_absences', {
      operations: operations as any,
      logged_by_staff_id: staffId,
    });

    if (error) {
      console.error('Error calling log_student_absences RPC:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to log absences' },
        { status: 500 }
      );
    }

    // Check if the RPC function returned an error in the result
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return NextResponse.json(
        { error: (data as any).error || 'Failed to log absences' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in log absences API route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

