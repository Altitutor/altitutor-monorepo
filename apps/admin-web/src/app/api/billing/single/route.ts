import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Tables } from '@altitutor/shared';
import { getErrorMessage } from '@/shared/utils';

type StaffRoleStatus = Pick<Tables<'staff'>, 'role' | 'status'>;

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin staff
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const staff = staffData as StaffRoleStatus;
    if (staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { sessions_students_id } = body;

    if (!sessions_students_id) {
      return NextResponse.json(
        { error: 'sessions_students_id is required' },
        { status: 400 }
      );
    }

    // Get Supabase URL and service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Call the billing-single edge function with service role key
    // Also pass admin token for development-mode bypass
    const response = await fetch(`${supabaseUrl}/functions/v1/billing-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'x-admin-token': session.access_token, // Pass admin token for dev bypass
      },
      body: JSON.stringify({ 
        sessions_students_id
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to invoice session', message: data.message },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error invoicing single session:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
