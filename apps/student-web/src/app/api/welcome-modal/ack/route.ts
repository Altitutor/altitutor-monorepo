import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import type { Database } from '@altitutor/shared';

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

/**
 * PATCH /api/welcome-modal/ack
 * Mark welcome modal as acknowledged for current student.
 *
 * Authorization:
 * - User must be a student
 * - Can only acknowledge their own modal state
 */
export async function PATCH(_request: NextRequest) {
  try {
    const userClient = createServerClient();

    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');
    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify student status' },
        { status: 500 }
      );
    }

    if (!isStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a student' },
        { status: 403 }
      );
    }

    const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');
    if (studentIdError || !studentId) {
      console.error('Error getting student ID:', studentIdError);
      return NextResponse.json(
        { error: 'Failed to get student ID' },
        { status: 500 }
      );
    }

    const adminClient = getServerSupabaseAdmin();
    const acknowledgedAt = new Date().toISOString();

    const { data: updatedStudent, error: updateError } = await adminClient
      .from('students')
      .update({ welcome_modal_acknowledged_at: acknowledgedAt })
      .eq('id', studentId)
      .is('welcome_modal_acknowledged_at', null)
      .select('welcome_modal_acknowledged_at')
      .maybeSingle();

    if (updateError) {
      console.error('Error acknowledging welcome modal:', updateError);
      return NextResponse.json(
        { error: 'Failed to acknowledge welcome modal' },
        { status: 500 }
      );
    }

    const wasUpdated = !!updatedStudent;

    if (wasUpdated) {
      return NextResponse.json({
        success: true,
        data: {
          acknowledged_at: updatedStudent.welcome_modal_acknowledged_at,
          alreadyAcknowledged: false,
        },
      });
    }

    const { data: profile, error: profileError } = await userClient
      .from('vstudent_profile')
      .select('welcome_modal_acknowledged_at')
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching existing welcome modal state:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch existing welcome modal state' },
        { status: 500 }
      );
    }

    const typedProfile = profile as Pick<StudentProfile, 'welcome_modal_acknowledged_at'> | null;

    return NextResponse.json({
      success: true,
      data: {
        acknowledged_at: typedProfile?.welcome_modal_acknowledged_at ?? null,
        alreadyAcknowledged: true,
      },
    });
  } catch (error) {
    console.error('Error in PATCH /api/welcome-modal/ack:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
