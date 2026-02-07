import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function POST(request: NextRequest) {
  try {
    // Use service role client to bypass RLS (this is a public endpoint for invite acceptance)
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

    const body = await request.json();
    const { token, email, password } = body;

    // Validate required fields
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: token, email, password' },
        { status: 400 }
      );
    }

    // Find staff member with this invite token
    const { data: staffMember, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, first_name, last_name, email, role, user_id, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching staff with invite token:', fetchError);
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if staff already has a user account
    if (staffMember.user_id) {
      return NextResponse.json(
        { error: 'This staff member already has an account' },
        { status: 400 }
      );
    }

    // Create auth user (Supabase will generate a new UUID for auth.users.id)
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email for invites
      user_metadata: {
        first_name: staffMember.first_name,
        last_name: staffMember.last_name,
        invite_token: token, // Include token for the link_precreated_user trigger
      }
    });

    if (createAuthError) {
      console.error('Failed to create auth user:', createAuthError);
      return NextResponse.json(
        { error: `Failed to create account: ${createAuthError.message}` },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Auth user creation succeeded but no user returned' },
        { status: 500 }
      );
    }

    // Update staff record - link to auth user, update email if changed, clear invite token
    const updateData: {
      user_id: string;
      invite_token: null;
      email?: string;
    } = {
      user_id: authData.user.id,
      invite_token: null, // Clear the token after successful use
    };

    // If email was changed during invite acceptance, update it
    if (email !== staffMember.email) {
      updateData.email = email;
    }

    const { data: updatedStaff, error: updateError } = await supabaseAdmin
      .from('staff')
      .update(updateData)
      .eq('id', staffMember.id)
      .select('id, first_name, last_name, email, role')
      .single();

    if (updateError) {
      console.error('Failed to update staff record:', updateError);
      // Clean up the auth user if staff update fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to link account: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Create a session for the user to auto-login
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error('Failed to generate session:', sessionError);
      // Account is created, but they'll need to login manually
      return NextResponse.json({
        success: true,
        message: 'Account created successfully. Please login.',
        data: updatedStaff,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: updatedStaff,
      session: sessionData,
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error accepting invite:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

