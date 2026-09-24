import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@altitutor/shared';
import {
  createServiceRoleClient,
  isPublicBookingIdentifierRevoked,
  isValidUuid,
  loadPublicBookingSession,
} from '@/features/bookings/lib/public-booking-guards';

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

    // Use service role to bypass RLS for public trial session lookup
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const serviceRoleSupabase = createServiceRoleClient();

    if (await isPublicBookingIdentifierRevoked(serviceRoleSupabase, sessionId)) {
      return NextResponse.json(
        { error: 'This booking link has been replaced. Please use the newest link from Altitutor.', revoked: true },
        { status: 410 }
      );
    }

    const sessionData = await loadPublicBookingSession(serviceRoleSupabase, sessionId);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found or is not a public booking type' },
        { status: 404 }
      );
    }

    const { data: studentData, error: studentError } = await serviceRoleSupabase
      .from('students')
      .select('id, first_name, last_name, email, phone, curriculum, year_level')
      .eq('id', sessionData.student_id)
      .single();

    if (studentError || !studentData) {
      return NextResponse.json(
        { error: 'Student data not found' },
        { status: 404 }
      );
    }

    const isTerminal = sessionData.status !== 'ACTIVE' || new Date(sessionData.end_at) <= new Date();
    const { data: subjectsData } = isTerminal
      ? { data: [] }
      : await serviceRoleSupabase
          .from('students_subjects')
          .select('subject_id, subjects(*)')
          .eq('student_id', studentData.id);

    const subjects = (subjectsData ?? [])
      .map((item) => item.subjects)
      .filter((s): s is Database['public']['Tables']['subjects']['Row'] => s !== null);

    // Transform to match BookingData interface
    const bookingData = {
      session_id: sessionData.id,
      session_type: sessionData.type,
      status: sessionData.status,
      is_terminal: isTerminal,
      booking_token: isValidUuid(sessionId) ? null : sessionId,
      start_at: sessionData.start_at,
      end_at: sessionData.end_at,
      student_first_name: studentData.first_name,
      student_last_name: isTerminal ? '' : studentData.last_name,
      student_email: isTerminal ? '' : (studentData.email || ''),
      student_phone: isTerminal ? undefined : (studentData.phone || undefined),
      curriculum: isTerminal ? '' : (studentData.curriculum || ''),
      year_level: isTerminal ? undefined : (studentData.year_level || undefined),
      subject_ids: subjects.map((s) => s.id),
      subjects: subjects.length > 0 ? subjects : undefined,
    };

    return NextResponse.json(bookingData);
  } catch (error) {
    captureApiError(error, "/api/bookings/trial/[sessionId]");
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
