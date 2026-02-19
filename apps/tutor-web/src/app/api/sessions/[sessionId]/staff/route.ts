import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TablesInsert } from '@altitutor/shared';

/**
 * POST /api/sessions/[sessionId]/staff
 * Assign a staff member to a session
 * 
 * Authorization:
 * - User must be an active tutor
 * - Session must be accessible by the tutor (checked via vtutor_sessions)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await request.json();
    const { staffId, type = 'MAIN_TUTOR' } = body;
    
    if (!staffId || typeof staffId !== 'string') {
      return NextResponse.json(
        { error: 'staffId is required' },
        { status: 400 }
      );
    }
    
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
    
    // Verify the session is accessible by this tutor
    const { data: sessionAccess, error: sessionError } = await userClient
      .from('vtutor_sessions')
      .select('session_id')
      .eq('session_id', params.sessionId)
      .maybeSingle();
    
    if (sessionError) {
      console.error('Error checking session access:', sessionError);
      return NextResponse.json(
        { error: 'Failed to verify session access' },
        { status: 500 }
      );
    }
    
    if (!sessionAccess) {
      return NextResponse.json(
        { error: 'Session not found or not accessible' },
        { status: 404 }
      );
    }
    
    // Validate type
    const validTypes = ['MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Use service role client to insert (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    // Check if staff assignment already exists
    const { data: existing, error: checkError } = await serviceClient
      .from('sessions_staff')
      .select('id')
      .eq('session_id', params.sessionId)
      .eq('staff_id', staffId)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing assignment:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing assignment' },
        { status: 500 }
      );
    }
    
    if (existing) {
      return NextResponse.json(
        { error: 'Staff member already assigned to this session' },
        { status: 400 }
      );
    }
    
    // Insert staff assignment
    const payload: TablesInsert<'sessions_staff'> = {
      id: crypto.randomUUID(),
      session_id: params.sessionId,
      staff_id: staffId,
      type: type as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR',
    };
    
    const { data, error } = await serviceClient
      .from('sessions_staff')
      .insert(payload)
      .select()
      .single();
    
    if (error) {
      console.error('Error assigning staff to session:', error);
      return NextResponse.json(
        { error: 'Failed to assign staff to session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/sessions/[sessionId]/staff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
