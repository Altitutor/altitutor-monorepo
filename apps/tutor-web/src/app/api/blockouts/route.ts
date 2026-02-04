import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';

/**
 * GET /api/blockouts
 * Get tutor's own blockouts
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 */
export async function GET() {
  try {
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
    
    // Query vtutor_blockouts view (read-only access)
    const { data, error } = await userClient
      .from('vtutor_blockouts')
      .select('*')
      .order('start_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching blockouts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blockouts' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: data ?? [],
    });
    
  } catch (error) {
    console.error('Error in GET /api/blockouts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blockouts
 * Create a new blockout for the current tutor
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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
    
    // Validate required fields
    if (!body.start_at || !body.end_at) {
      return NextResponse.json(
        { error: 'start_at and end_at are required' },
        { status: 400 }
      );
    }
    
    // Validate date range
    const startAt = new Date(body.start_at);
    const endAt = new Date(body.end_at);
    if (endAt <= startAt) {
      return NextResponse.json(
        { error: 'end_at must be after start_at' },
        { status: 400 }
      );
    }
    
    // Use service role client to insert (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    const { data, error } = await serviceClient
      .from('booking_staff_unavailability')
      .insert({
        staff_id: tutorId,
        start_at: body.start_at,
        end_at: body.end_at,
        reason: body.reason || null,
        created_by: tutorId,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating blockout:', error);
      return NextResponse.json(
        { error: 'Failed to create blockout' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
    });
    
  } catch (error) {
    console.error('Error in POST /api/blockouts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

