import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import {
  createServiceRoleClient,
  formatSessionDateTime,
  getBookingConfirmationUrl,
  getMinAdvanceBookingDays,
  isWithinMinAdvanceThreshold,
  loadPublicBookingSession,
} from '@/features/bookings/lib/public-booking-guards';
import { sendEmail } from '@/shared/lib/email';
import { buildBookingChangedEmail } from '@altitutor/email';
import { capturePublicBookingOutcome } from '@/features/bookings/lib/capture-public-booking-outcome';
import { IN_PERSON_BOOKING_EVENTS } from '@/shared/lib/analytics/in-person-booking-event';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: 'Booking link is required' }, { status: 400 });
    }

    const body = await request.json();
    const startAt = typeof body.start_at === 'string' ? body.start_at : null;
    const endAt = typeof body.end_at === 'string' ? body.end_at : null;

    if (!startAt || !endAt) {
      return NextResponse.json(
        { error: 'start_at and end_at are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const session = await loadPublicBookingSession(supabase, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This booking is no longer active' },
        { status: 409 }
      );
    }

    const minAdvanceDays = await getMinAdvanceBookingDays(supabase);
    if (isWithinMinAdvanceThreshold(session.start_at, minAdvanceDays)) {
      return NextResponse.json(
        {
          error: `Sessions cannot be changed within ${minAdvanceDays} day${minAdvanceDays === 1 ? '' : 's'} of the booking.`,
        },
        { status: 403 }
      );
    }

    if (isWithinMinAdvanceThreshold(startAt, minAdvanceDays)) {
      return NextResponse.json(
        {
          error: `New session time must be at least ${minAdvanceDays} day${minAdvanceDays === 1 ? '' : 's'} in advance.`,
        },
        { status: 403 }
      );
    }

    const { data: rescheduledId, error: rescheduleError } = await supabase.rpc(
      'reschedule_session',
      {
        p_original_session_id: session.id,
        p_student_id: session.student_id,
        p_session_type: session.type,
        p_start_at: startAt,
        p_end_at: endAt,
        p_subject_id: session.subject_id ?? undefined,
        p_created_by: undefined,
        p_bypass_date_restrictions: false,
      }
    );

    if (rescheduleError) {
      console.error('Failed to reschedule public booking:', rescheduleError);
      return NextResponse.json(
        { error: rescheduleError.message || 'Failed to change session' },
        { status: 400 }
      );
    }

    const { sessionDate, sessionTime } = formatSessionDateTime(startAt, endAt);
    const { data: bookingToken } = await supabase.rpc(
      'issue_session_booking_public_token',
      { p_session_id: session.id }
    );
    if (session.student_email) {
      try {
        await sendEmail({
          to: session.student_email,
          email: buildBookingChangedEmail({
            recipientName: [session.student_first_name, session.student_last_name]
              .filter(Boolean)
              .join(' '),
            sessionDate,
            sessionTime,
            bookingUrl: getBookingConfirmationUrl(
              typeof bookingToken === 'string' ? bookingToken : sessionId
            ),
          }),
        });
      } catch (emailError) {
        console.error('Failed to send booking change email:', emailError);
      }
    }

    const { data: updatedSession } = await supabase
      .from('sessions')
      .select('id, start_at, end_at, type, status')
      .eq('id', session.id)
      .single();

    capturePublicBookingOutcome(request, {
      event: IN_PERSON_BOOKING_EVENTS.rescheduled,
      sessionId: String(rescheduledId ?? session.id),
      sessionType: session.type,
      studentId: session.student_id,
      properties: {
        previous_start_at: session.start_at,
        start_at: updatedSession?.start_at ?? startAt,
      },
    });

    return NextResponse.json({
      session_id: rescheduledId ?? session.id,
      start_at: updatedSession?.start_at ?? startAt,
      end_at: updatedSession?.end_at ?? endAt,
      session_type: updatedSession?.type ?? session.type,
      status: updatedSession?.status ?? 'ACTIVE',
    });
  } catch (error) {
    captureApiError(error, "/api/bookings/trial/[sessionId]/reschedule");
    console.error('Public booking reschedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
