import { NextRequest, NextResponse } from 'next/server';
import {
  createServiceRoleClient,
  formatSessionDateTime,
  getMinAdvanceBookingDays,
  isValidUuid,
  isWithinMinAdvanceThreshold,
  loadPublicBookingSession,
} from '@/features/bookings/lib/public-booking-guards';
import { sendEmail } from '@/shared/lib/email';
import { getBookingCancelledEmailTemplate } from '@/shared/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    if (!sessionId || !isValidUuid(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
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
          subject: 'Your Altitutor session has been cancelled',
          html: getBookingCancelledEmailTemplate({
            firstName: session.student_first_name,
            lastName: session.student_last_name,
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
    console.error('Public booking cancel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
