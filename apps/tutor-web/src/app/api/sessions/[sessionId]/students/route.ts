import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TablesInsert } from '@altitutor/shared';

/**
 * POST /api/sessions/[sessionId]/students
 * Add a student to a session
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
    const { studentId } = body;
    
    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { error: 'studentId is required' },
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
    
    // Use service role client to insert (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    // Check if student assignment already exists
    const { data: existing, error: checkError } = await serviceClient
      .from('sessions_students')
      .select('id')
      .eq('session_id', params.sessionId)
      .eq('student_id', studentId)
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
        { error: 'Student already assigned to this session' },
        { status: 400 }
      );
    }
    
    // Insert student assignment
    const payload: TablesInsert<'sessions_students'> = {
      id: crypto.randomUUID(),
      session_id: params.sessionId,
      student_id: studentId,
    };
    
    const { data, error } = await serviceClient
      .from('sessions_students')
      .insert(payload)
      .select()
      .single();
    
    if (error) {
      console.error('Error adding student to session:', error);
      return NextResponse.json(
        { error: 'Failed to add student to session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/sessions/[sessionId]/students:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
