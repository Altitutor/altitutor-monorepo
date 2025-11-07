import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function POST(request: NextRequest) {
  try {
    // Create admin client using service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await request.json();
    const { token, email, password } = body;

    // Validate required fields
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: token, email, password' },
        { status: 400 }
      );
    }

    // Find student with this invite token
    const { data: student, error: fetchError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, email, user_id, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching student with invite token:', fetchError);
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if student already has a user account
    if (student.user_id) {
      return NextResponse.json(
        { error: 'This student already has an account' },
        { status: 400 }
      );
    }

    // Create auth user (Supabase will generate a new UUID for auth.users.id)
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email for invites
      user_metadata: {
        first_name: student.first_name,
        last_name: student.last_name,
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

    // Update student record - link to auth user, update email if changed, clear invite token
    const updateData: any = {
      user_id: authData.user.id,
      invite_token: null, // Clear the token after successful use
    };

    // If email was changed during invite acceptance, update it
    if (email !== student.email) {
      updateData.email = email;
    }

    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from('students')
      .update(updateData)
      .eq('id', student.id)
      .select('id, first_name, last_name, email')
      .single();

    if (updateError) {
      console.error('Failed to update student record:', updateError);
      // Clean up the auth user if student update fails
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
        data: updatedStudent,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: updatedStudent,
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

