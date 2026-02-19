import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@altitutor/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operations, staffId } = body;

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

    const { data, error } = await supabase.rpc('undo_student_absences' as any, {
      operations: operations as Json,
      logged_by_staff_id: staffId,
    });

    if (error) {
      console.error('Error calling undo_student_absences RPC:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to undo absences' },
        { status: 500 }
      );
    }

    type RpcResult = { success: boolean; error?: string } | unknown;
    if (data && typeof data === 'object' && 'success' in data && !(data as RpcResult & { success: boolean }).success) {
      const errorResult = data as RpcResult & { success: boolean; error?: string };
      return NextResponse.json(
        { error: errorResult.error || 'Failed to undo absences' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in undo absences API route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
