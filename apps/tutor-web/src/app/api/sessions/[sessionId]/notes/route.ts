import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Json, TablesInsert } from '@altitutor/shared';

function toTiptapJson(val: string | Record<string, unknown>): Json {
  if (typeof val === 'object' && val !== null && 'type' in val && val.type === 'doc') {
    return val as Json;
  }
  const text = typeof val === 'string' ? val : String(val);
  if (!text.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] } as Json;
  }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  } as Json;
}

/**
 * POST /api/sessions/[sessionId]/notes
 * Create a note for a session
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
    const { note } = body;

    if (note === undefined || note === null) {
      return NextResponse.json(
        { error: 'Note is required' },
        { status: 400 }
      );
    }

    const noteContent = typeof note === 'string' && !note.trim()
      ? null
      : toTiptapJson(note as string | Record<string, unknown>);

    if (!noteContent) {
      return NextResponse.json(
        { error: 'Note is required' },
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
        { error: 'Unauthorized: Session not accessible' },
        { status: 403 }
      );
    }
    
    // Use service role client to create the note
    const serviceClient = getServiceRoleClient();
    
    const noteInsert: TablesInsert<'notes'> = {
      target_type: 'sessions',
      target_id: params.sessionId,
      note: noteContent,
      created_by: tutorId,
    };
    
    const { data, error } = await serviceClient
      .from('notes')
      .insert(noteInsert)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json(
        { error: 'Failed to create note' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in POST /api/sessions/[sessionId]/notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

