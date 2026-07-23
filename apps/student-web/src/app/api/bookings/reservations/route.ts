import { NextRequest, NextResponse } from 'next/server';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';

const ALLOWED_SESSION_TYPES = new Set([
  'DRAFTING',
  'TRIAL_SESSION',
  'SUBSIDY_INTERVIEW',
]);

async function authenticatedUser() {
  const { data: { user }, error } = await createUserClient().auth.getUser();
  return error ? null : user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const startAt = new Date(body.start_at);
    const endAt = new Date(body.end_at);
    if (
      !ALLOWED_SESSION_TYPES.has(body.session_type) ||
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      startAt < new Date() ||
      endAt <= startAt
    ) {
      return NextResponse.json({ error: 'Invalid reservation' }, { status: 400 });
    }

    const { data, error } = await getServerSupabaseAdmin()
      .from('slot_reservations')
      .insert({
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        session_type: body.session_type,
        subject_id: body.subject_id || null,
        staff_id: body.staff_id || null,
        reserved_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    captureApiError(error, '/api/bookings/reservations');
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Reservation id is required' }, { status: 400 });

    const { data, error } = await getServerSupabaseAdmin()
      .from('slot_reservations')
      .delete()
      .eq('id', id)
      .eq('reserved_by', user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    captureApiError(error, '/api/bookings/reservations');
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
}
