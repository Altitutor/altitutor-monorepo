import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS for public trial session lookup
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const serviceRoleSupabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Query session first
    const { data: sessionData, error: sessionError } = await serviceRoleSupabase
      .from('sessions')
      .select('id, start_at, end_at, type')
      .eq('id', sessionId)
      .eq('type', 'TRIAL_SESSION')
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get student ID from sessions_students
    const { data: sessionStudentData, error: sessionStudentError } = await serviceRoleSupabase
      .from('sessions_students')
      .select('student_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionStudentError || !sessionStudentData) {
      return NextResponse.json(
        { error: 'Student not found for this session' },
        { status: 404 }
      );
    }

    const { data: studentData, error: studentError } = await serviceRoleSupabase
      .from('students')
      .select('id, first_name, last_name, email, phone, curriculum, year_level')
      .eq('id', sessionStudentData.student_id)
      .single();

    if (studentError || !studentData) {
      return NextResponse.json(
        { error: 'Student data not found' },
        { status: 404 }
      );
    }

    // Get subjects for this student
    const { data: subjectsData } = await serviceRoleSupabase
      .from('students_subjects')
      .select('subject_id, subjects(*)')
      .eq('student_id', studentData.id);

    const subjects = subjectsData
      ?.map((item) => item.subjects)
      .filter((s): s is Database['public']['Tables']['subjects']['Row'] => s !== null) || [];

    // Transform to match BookingData interface
    const bookingData = {
      session_id: sessionData.id,
      start_at: sessionData.start_at,
      end_at: sessionData.end_at,
      student_first_name: studentData.first_name,
      student_last_name: studentData.last_name,
      student_email: studentData.email || '',
      student_phone: studentData.phone || undefined,
      curriculum: studentData.curriculum || '',
      year_level: studentData.year_level || undefined,
      subject_ids: subjects.map((s) => s.id),
      subjects: subjects.length > 0 ? subjects : undefined,
    };

    return NextResponse.json(bookingData);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
