import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Database } from '@altitutor/shared';

/**
 * PATCH /api/blockouts/[id]
 * Update a blockout for the current tutor
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - Blockout must belong to the current tutor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const blockoutId = params.id;
    
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
    
    // Verify the blockout belongs to this tutor (check via view)
    const { data: blockoutAccess, error: blockoutError } = await userClient
      .from('vtutor_blockouts')
      .select('id, staff_id')
      .eq('id', blockoutId)
      .maybeSingle();
    
    if (blockoutError) {
      console.error('Error checking blockout access:', blockoutError);
      return NextResponse.json(
        { error: 'Failed to verify blockout access' },
        { status: 500 }
      );
    }
    
    if (!blockoutAccess) {
      return NextResponse.json(
        { error: 'Blockout not found or access denied' },
        { status: 404 }
      );
    }
    
    // Validate date range if both dates are provided
    if (body.start_at && body.end_at) {
      const startAt = new Date(body.start_at);
      const endAt = new Date(body.end_at);
      if (endAt <= startAt) {
        return NextResponse.json(
          { error: 'end_at must be after start_at' },
          { status: 400 }
        );
      }
    }
    
    // Build update object
    const updates: Record<string, any> = {};
    if (body.start_at !== undefined) updates.start_at = body.start_at;
    if (body.end_at !== undefined) updates.end_at = body.end_at;
    if (body.reason !== undefined) updates.reason = body.reason || null;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }
    
    // Use service role client to update (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    const { data, error } = await serviceClient
      .from('booking_staff_unavailability')
      .update(updates)
      .eq('id', blockoutId)
      .eq('staff_id', tutorId) // Double-check ownership
      .select()
      .single();
    
    if (error) {
      console.error('Error updating blockout:', error);
      return NextResponse.json(
        { error: 'Failed to update blockout' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
    });
    
  } catch (error) {
    console.error('Error in PATCH /api/blockouts/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/blockouts/[id]
 * Delete a blockout for the current tutor
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - Blockout must belong to the current tutor
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blockoutId = params.id;
    
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
    
    // Verify the blockout belongs to this tutor (check via view)
    const { data: blockoutAccess, error: blockoutError } = await userClient
      .from('vtutor_blockouts')
      .select('id, staff_id')
      .eq('id', blockoutId)
      .maybeSingle();
    
    if (blockoutError) {
      console.error('Error checking blockout access:', blockoutError);
      return NextResponse.json(
        { error: 'Failed to verify blockout access' },
        { status: 500 }
      );
    }
    
    if (!blockoutAccess) {
      return NextResponse.json(
        { error: 'Blockout not found or access denied' },
        { status: 404 }
      );
    }
    
    // Use service role client to delete (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    const { error } = await serviceClient
      .from('booking_staff_unavailability')
      .delete()
      .eq('id', blockoutId)
      .eq('staff_id', tutorId); // Double-check ownership
    
    if (error) {
      console.error('Error deleting blockout:', error);
      return NextResponse.json(
        { error: 'Failed to delete blockout' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/blockouts/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

