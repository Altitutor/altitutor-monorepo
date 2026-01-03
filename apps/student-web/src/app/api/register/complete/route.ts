import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function POST(request: NextRequest) {
  try {
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
    const {
      token,
      student,
      parents,
      subject_ids,
      password,
      confirmPassword,
    } = body;

    // Validate required fields
    if (!token || !student || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password strength (weaker requirements)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate student fields
    if (!student.first_name || !student.last_name || !student.email) {
      return NextResponse.json(
        { error: 'Student first name, last name, and email are required' },
        { status: 400 }
      );
    }

    // Validate parents
    if (!parents || !Array.isArray(parents) || parents.length === 0) {
      return NextResponse.json(
        { error: 'At least one parent is required' },
        { status: 400 }
      );
    }

    // Check if at least one parent has email and phone
    const hasValidParent = parents.some(
      (p: any) => p.email && p.email.trim() !== '' && p.phone && p.phone.trim() !== ''
    );

    if (!hasValidParent) {
      return NextResponse.json(
        { error: 'At least one parent must have both email and phone' },
        { status: 400 }
      );
    }

    // Validate availability (at least one day must be selected)
    const availabilityFields = [
      student.availability_monday,
      student.availability_tuesday,
      student.availability_wednesday,
      student.availability_thursday,
      student.availability_friday,
      student.availability_saturday_am,
      student.availability_saturday_pm,
      student.availability_sunday_am,
      student.availability_sunday_pm,
    ];

    const hasAvailability = availabilityFields.some((val) => val === true);

    if (!hasAvailability) {
      return NextResponse.json(
        { error: 'At least one availability day must be selected' },
        { status: 400 }
      );
    }

    // First, verify token is still valid and student exists
    const { data: studentCheck, error: studentCheckError } = await supabaseAdmin
      .from('students')
      .select('id, status, user_id, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (studentCheckError || !studentCheck) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    if (studentCheck.user_id || studentCheck.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'This student already has an account', alreadyRegistered: true },
        { status: 400 }
      );
    }

    // Note: We'll check for email conflicts during auth user creation
    // The createUser call will fail if the email already exists

    // Call the database function to atomically update student, parents, and subjects
    const { data: dbResult, error: dbError } = await supabaseAdmin.rpc(
      'complete_student_registration',
      {
        p_token: token,
        p_student_first_name: student.first_name,
        p_student_last_name: student.last_name,
        p_student_email: student.email,
        p_student_phone: student.phone || null,
        p_school: student.school || null,
        p_curriculum: student.curriculum || null,
        p_year_level: student.year_level || null,
        p_availability_monday: student.availability_monday || false,
        p_availability_tuesday: student.availability_tuesday || false,
        p_availability_wednesday: student.availability_wednesday || false,
        p_availability_thursday: student.availability_thursday || false,
        p_availability_friday: student.availability_friday || false,
        p_availability_saturday_am: student.availability_saturday_am || false,
        p_availability_saturday_pm: student.availability_saturday_pm || false,
        p_availability_sunday_am: student.availability_sunday_am || false,
        p_availability_sunday_pm: student.availability_sunday_pm || false,
        p_parents: parents,
        p_subject_ids: subject_ids || [],
      }
    );

    if (dbError) {
      console.error('Database function error:', dbError);
      return NextResponse.json(
        { error: `Registration failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Type the RPC result properly
    type CompleteRegistrationResult = {
      success: boolean;
      student_id?: string;
      error?: string;
      message?: string;
    };

    const result = dbResult as CompleteRegistrationResult | null;

    if (!result || !result.success) {
      return NextResponse.json(
        { error: result?.error || 'Registration failed' },
        { status: 400 }
      );
    }

    const studentId = result.student_id;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Registration failed: Student ID not returned' },
        { status: 500 }
      );
    }

    // Now create auth user and link it to the student
    // Use the invite_token in user_metadata so the trigger links it
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: student.email,
      password: password,
      email_confirm: true, // Auto-confirm email (Option A - confirm on link click)
      user_metadata: {
        first_name: student.first_name,
        last_name: student.last_name,
        invite_token: token, // Include token for the link_precreated_user trigger
      }
    });

    if (createAuthError) {
      console.error('Failed to create auth user:', createAuthError);
      // Check if error is due to email already existing
      if (createAuthError.message?.includes('already registered') || createAuthError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists', alreadyRegistered: true },
          { status: 409 }
        );
      }
      // Note: The database function already updated the student, but we can't rollback
      // In a real scenario, we might want to revert the student status
      // For now, we'll return an error and the student can try again with a new token
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

    // The link_precreated_user trigger should have linked the user, but let's verify
    // and manually link if needed (in case trigger didn't fire)
    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from('students')
      .select('id, user_id, status')
      .eq('id', studentId)
      .single();

    if (updateError) {
      console.error('Failed to verify student update:', updateError);
      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to verify registration' },
        { status: 500 }
      );
    }

    // If user_id wasn't set by trigger, set it manually
    if (!updatedStudent.user_id) {
      const { error: linkError } = await supabaseAdmin
        .from('students')
        .update({ user_id: authData.user.id })
        .eq('id', studentId!);

      if (linkError) {
        console.error('Failed to link user:', linkError);
        // Clean up auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json(
          { error: 'Failed to link account' },
          { status: 500 }
        );
      }
    }

    // Create a session for the user to auto-login
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: student.email,
    });

    if (sessionError) {
      console.error('Failed to generate session:', sessionError);
      // Account is created, but they'll need to login manually
      return NextResponse.json({
        success: true,
        message: 'Account created successfully. Please login.',
        redirectTo: '/login',
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
      redirectTo: '/dashboard',
      session: sessionData,
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error completing registration:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
