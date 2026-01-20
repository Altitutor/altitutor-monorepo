import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

/**
 * PATCH /api/notifications/[notificationId]
 * Mark a notification as read (only if it belongs to current student)
 * 
 * Authorization:
 * - User must be a student
 * - Notification must belong to the current student
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    // Get the authenticated user's supabase client
    const userClient = createServerClient();
    
    // Verify user is a student
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
    
    // Get current student's ID
    const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');
    
    if (studentIdError || !studentId) {
      console.error('Error getting student ID:', studentIdError);
      return NextResponse.json(
        { error: 'Failed to get student ID' },
        { status: 500 }
      );
    }
    
    // Verify the notification exists and belongs to this student
    // Use vstudent_notifications view to check (it filters by current_student_id)
    const { data: existingNotification, error: noteError } = await userClient
      .from('vstudent_notifications')
      .select('id, student_id')
      .eq('id', params.notificationId)
      .maybeSingle();
    
    if (noteError) {
      console.error('Error checking notification:', noteError);
      return NextResponse.json(
        { error: 'Failed to verify notification' },
        { status: 500 }
      );
    }
    
    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found or does not belong to you' },
        { status: 404 }
      );
    }
    
    // Double-check student_id matches (should be redundant since view filters, but extra safety)
    const notificationStudentId = (existingNotification as any).student_id;
    if (!notificationStudentId || notificationStudentId !== studentId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only mark your own notifications as read' },
        { status: 403 }
      );
    }
    
    // Use service role client to update the notification
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const serviceClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    const { error } = await serviceClient
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', params.notificationId)
      .eq('student_id', studentId);
    
    if (error) {
      console.error('Error updating notification:', error);
      return NextResponse.json(
        { error: 'Failed to mark notification as read' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in PATCH /api/notifications/[notificationId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
