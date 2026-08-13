import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import {
  createServiceRoleClient,
  formatSessionDateTime,
  getMinAdvanceBookingDays,
  isWithinMinAdvanceThreshold,
  loadPublicBookingSession,
} from '@/features/bookings/lib/public-booking-guards';
import { sendEmail } from '@/shared/lib/email';
import { buildBookingCancelledEmail } from '@altitutor/email';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: 'Booking link is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const session = await loadPublicBookingSession(supabase, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This booking is already cancelled' },
        { status: 409 }
      );
    }

    const minAdvanceDays = await getMinAdvanceBookingDays(supabase);
    if (isWithinMinAdvanceThreshold(session.start_at, minAdvanceDays)) {
      return NextResponse.json(
        {
          error: `Sessions cannot be cancelled within ${minAdvanceDays} day${minAdvanceDays === 1 ? '' : 's'} of the booking.`,
        },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'INACTIVE' })
      .eq('id', session.id)
      .eq('status', 'ACTIVE');

    if (updateError) {
      console.error('Failed to soft-cancel public booking:', updateError);
      captureApiError(updateError, "/api/bookings/trial/[sessionId]/cancel");
      return NextResponse.json(
        { error: 'Failed to cancel booking' },
        { status: 500 }
      );
    }

    const { sessionDate, sessionTime } = formatSessionDateTime(
      session.start_at,
      session.end_at
    );

    if (session.student_email) {
      try {
        await sendEmail({
          to: session.student_email,
          email: buildBookingCancelledEmail({
            recipientName: [session.student_first_name, session.student_last_name]
              .filter(Boolean)
              .join(' '),
            sessionDate,
            sessionTime,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send booking cancellation email:', emailError);
      }
    }

    return NextResponse.json({
      session_id: session.id,
      status: 'INACTIVE',
      cancelled: true,
    });
  } catch (error) {
    captureApiError(error, "/api/bookings/trial/[sessionId]/cancel");
    console.error('Public booking cancel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
