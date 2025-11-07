import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { Database } from '@altitutor/shared';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or staff with appropriate permissions
    const { data: currentUserStaff, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (staffError || !currentUserStaff || currentUserStaff.role !== 'ADMINSTAFF') {
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

    // Validate required fields
    if (!body.email || !body.first_name || !body.last_name || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, first_name, last_name, role' },
        { status: 400 }
      );
    }

    // Create/auth invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      body.email
    );

    if (inviteError) {
      return NextResponse.json(
        { error: `Failed to invite user: ${inviteError.message}` },
        { status: 500 }
      );
    }

    if (!inviteData.user) {
      return NextResponse.json(
        { error: 'Invitation succeeded but no user returned' },
        { status: 500 }
      );
    }

    // Create staff account associated to invited user
    const staffData = {
      id: inviteData.user.id,
      user_id: inviteData.user.id,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone_number: body.phone_number || null,
      role: body.role,
      status: body.status || 'ACTIVE',
      notes: body.notes || null,
      office_key_number: body.office_key_number || null,
      has_parking_remote: body.has_parking_remote || null,
      availability_monday: body.availability_monday || false,
      availability_tuesday: body.availability_tuesday || false,
      availability_wednesday: body.availability_wednesday || false,
      availability_thursday: body.availability_thursday || false,
      availability_friday: body.availability_friday || false,
      availability_saturday_am: body.availability_saturday_am || false,
      availability_saturday_pm: body.availability_saturday_pm || false,
      availability_sunday_am: body.availability_sunday_am || false,
      availability_sunday_pm: body.availability_sunday_pm || false,
    };

    const { data: staffRecord, error: staffCreateError } = await supabase
      .from('staff')
      .insert(staffData)
      .select()
      .single();

    if (staffCreateError) {
      // Clean up the auth user if staff creation fails
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      return NextResponse.json(
        { error: `Failed to create staff record: ${staffCreateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: staffRecord }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error inviting staff:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

