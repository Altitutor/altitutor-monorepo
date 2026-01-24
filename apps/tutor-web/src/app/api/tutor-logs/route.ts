import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import type { TutorLogFormData } from '@/features/tutor-logs/types';
import type { Database } from '@altitutor/shared';

/**
 * POST /api/tutor-logs
 * Create a new tutor log using the create_tutor_log RPC function
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - Session must be accessible by the tutor (checked via vtutor_sessions view)
 */
export async function POST(request: NextRequest) {
  try {
    const body: TutorLogFormData = await request.json();
    
    // Validate required fields
    if (!body || !body.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }
    
    // Get the authenticated user's supabase client
    const userClient = createUserClient();
    
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
    
    // Verify the session is accessible by this tutor (check vtutor_sessions view)
    const { data: sessionAccess, error: sessionError } = await userClient
      .from('vtutor_sessions')
      .select('session_id, start_at')
      .eq('session_id', body.sessionId)
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
        { error: 'Unauthorized: You do not have access to this session' },
        { status: 403 }
      );
    }

    // Type assertion: sessionAccess has session_id and start_at from vtutor_sessions view
    type SessionAccess = Pick<Database['public']['Views']['vtutor_sessions']['Row'], 'session_id' | 'start_at'>;
    const typedSessionAccess = sessionAccess as SessionAccess;

    // Validate that session is loggable (today or past dates only, not future dates)
    if (typedSessionAccess.start_at) {
      const sessionDate = new Date(typedSessionAccess.start_at);
      const today = new Date();
      
      // Set both to midnight for date-only comparison
      sessionDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      // Block logging if session date is in the future (tomorrow or later)
      if (sessionDate > today) {
        return NextResponse.json(
          { error: 'Cannot log tutor log for future sessions. Only sessions from today or earlier can be logged.' },
          { status: 400 }
        );
      }
    }
    
    // Check if a tutor log already exists for this session
    const { data: existingLog, error: existingLogError } = await userClient
      .from('vtutor_tutor_log')
      .select('tutor_log_id')
      .eq('session_id', body.sessionId)
      .maybeSingle();
    
    if (existingLogError) {
      console.error('Error checking existing log:', existingLogError);
      return NextResponse.json(
        { error: 'Failed to check for existing log' },
        { status: 500 }
      );
    }
    
    if (existingLog) {
      return NextResponse.json(
        { error: 'A tutor log already exists for this session' },
        { status: 409 }
      );
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Prepare data for RPC call
    const staffAttendance = (body.staffAttendance || []).map((sa) => ({
      staffId: sa.staffId,
      attended: sa.attended,
      type: sa.type,
    }));

    const studentAttendance = (body.studentAttendance || []).map((sa) => ({
      studentId: sa.studentId,
      attended: sa.attended,
    }));

    const topics = (body.topics || []).map((t) => ({
      topicId: t.topicId,
      studentIds: t.studentIds || [],
    }));

    const topicFiles = (body.topicFiles || []).map((tf) => ({
      topicsFilesId: tf.topicsFilesId,
      topicId: tf.topicId,
      studentIds: tf.studentIds || [],
    }));

    // Ensure notes is an array of non-empty strings
    // Trim whitespace only when submitting (not during typing)
    const notes: string[] = Array.isArray(body.notes)
      ? body.notes
          .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
          .map((note) => String(note).trim())
      : [];

    // Prepare RPC parameters
    // The RPC function now handles both NULL and empty arrays correctly
    // Pass empty arrays as [] - the function will handle serialization issues
    const rpcParams = {
      p_session_id: body.sessionId,
      p_created_by: tutorId,
      p_staff_attendance: staffAttendance.length > 0 ? staffAttendance : [],
      p_student_attendance: studentAttendance.length > 0 ? studentAttendance : [],
      p_topics: topics.length > 0 ? topics : [],
      p_topic_files: topicFiles.length > 0 ? topicFiles : [],
      p_notes: notes.length > 0 ? notes : [],
    };

    // Call the RPC function
    const { data: result, error } = await supabase.rpc('create_tutor_log' as any, rpcParams);

    if (error) {
      console.error('Error calling create_tutor_log RPC:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create tutor log' },
        { status: 500 }
      );
    }

    // Check if the RPC function returned an error in the result
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return NextResponse.json(
        { error: (result as any).error || 'Failed to create tutor log' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Unexpected error in POST /api/tutor-logs:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

