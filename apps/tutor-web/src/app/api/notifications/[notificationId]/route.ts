import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';

/**
 * PATCH /api/notifications/[notificationId]
 * Mark a notification as read (only if it belongs to current tutor)
 * 
 * Authorization:
 * - User must be an active tutor
 * - Notification must belong to the current tutor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a tutor
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');
    
    if (tutorCheckError) {
      console.error('Error checking tutor status:', tutorCheckError);
      return NextResponse.json(
        { error: 'Failed to verify tutor status' },
        { status: 500 }
      );
    }
    
    if (!isTutor) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a tutor' },
        { status: 403 }
      );
    }
    
    // Get current tutor's staff ID
    const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id');
    
    if (tutorIdError || !tutorId) {
      console.error('Error getting tutor ID:', tutorIdError);
      return NextResponse.json(
        { error: 'Failed to get tutor ID' },
        { status: 500 }
      );
    }
    
    // Verify the notification exists and belongs to this tutor
    // Use vtutor_notifications view to check (it filters by current_tutor_id)
    const { data: existingNotification, error: noteError } = await userClient
      .from('vtutor_notifications')
      .select('id, staff_id')
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
    
    // Double-check staff_id matches (should be redundant since view filters, but extra safety)
    const notificationStaffId = (existingNotification as any).staff_id;
    if (!notificationStaffId || notificationStaffId !== tutorId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only mark your own notifications as read' },
        { status: 403 }
      );
    }
    
    // Use service role client to update the notification
    const serviceClient = getServiceRoleClient();
    
    const { error } = await serviceClient
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', params.notificationId)
      .eq('staff_id', tutorId);
    
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
