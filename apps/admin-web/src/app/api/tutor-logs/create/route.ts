import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import type { TutorLogFormData } from '@/features/tutor-logs/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, createdBy } = body as { data: TutorLogFormData; createdBy: string };

    // Validate required fields
    if (!data || !data.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: 'createdBy is required' },
        { status: 400 }
      );
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
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
    const staffAttendance = (data.staffAttendance || []).map((sa) => ({
      staffId: sa.staffId,
      attended: sa.attended,
      type: sa.type,
    }));

    const studentAttendance = (data.studentAttendance || []).map((sa) => ({
      studentId: sa.studentId,
      attended: sa.attended,
    }));

    const topics = (data.topics || []).map((t) => ({
      topicId: t.topicId,
      studentIds: t.studentIds || [],
    }));

    const topicFiles = (data.topicFiles || []).map((tf) => ({
      topicsFilesId: tf.topicsFilesId,
      topicId: tf.topicId,
      studentIds: tf.studentIds || [],
    }));

    // Ensure notes is an array of non-empty strings
    // Filter out any invalid values and ensure all are strings
    const notes: string[] = Array.isArray(data.notes)
      ? data.notes
          .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
          .map((note) => String(note).trim())
      : [];

    // Prepare RPC parameters
    const rpcParams = {
      p_session_id: data.sessionId,
      p_created_by: createdBy,
      p_staff_attendance: staffAttendance.length > 0 ? staffAttendance : [],
      p_student_attendance: studentAttendance.length > 0 ? studentAttendance : [],
      p_topics: topics.length > 0 ? topics : [],
      p_topic_files: topicFiles.length > 0 ? topicFiles : [],
      p_notes: notes.length > 0 ? notes : [],
    };

    // Call the RPC function
    const { data: result, error } = await supabase.rpc('create_tutor_log' as any, rpcParams);

    if (error) {
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
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

