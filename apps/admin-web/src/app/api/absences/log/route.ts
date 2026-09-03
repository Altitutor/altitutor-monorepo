import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@altitutor/shared';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';

const REASON_CATEGORIES = new Set(['approved_absence', 'extended_absence', 'admin_discretion']);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operations, reasonCategory, reasonNote } = body;

    const userClient = createUserClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staff, error: adminError } = await userClient
      .from('staff')
      .select('id, role, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminError || !staff || staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Validate required fields
    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json({ error: 'operations array is required' }, { status: 400 });
    }

    const actions = operations.map((operation) =>
      operation && typeof operation === 'object' ? (operation as { action?: unknown }).action : null,
    );
    const requestedAction = actions[0];
    if (
      (requestedAction !== 'credit' && requestedAction !== 'reschedule') ||
      actions.some((action) => action !== requestedAction)
    ) {
      return NextResponse.json(
        {
          error: 'Credit and reschedule must be submitted as separate operations',
        },
        { status: 400 },
      );
    }

    if (typeof reasonCategory !== 'string' || !REASON_CATEGORIES.has(reasonCategory)) {
      return NextResponse.json({ error: 'A valid absence reason is required' }, { status: 400 });
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Call the RPC function
    // operations is JSONB array, validate it's an array and cast to Json
    const { data, error } = await supabase.rpc('log_student_absences_with_billing', {
      operations: operations as Json,
      logged_by_staff_id: staff.id,
      reason_category: reasonCategory,
      reason_note: typeof reasonNote === 'string' ? reasonNote : undefined,
    });

    if (error) {
      console.error('Error calling log_student_absences_with_billing RPC:', error);
      captureApiError(error, '/api/absences/log');
      return NextResponse.json({ error: error.message || 'Failed to log absences' }, { status: 500 });
    }

    // Check if the RPC function returned an error in the result
    type RpcResult = { success: boolean; error?: string } | unknown;
    if (data && typeof data === 'object' && 'success' in data && !(data as RpcResult & { success: boolean }).success) {
      const errorResult = data as RpcResult & {
        success: boolean;
        error?: string;
      };
      return NextResponse.json({ error: errorResult.error || 'Failed to log absences' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    captureApiError(error, '/api/absences/log');
    console.error('Unexpected error in log absences API route:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
