import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@altitutor/shared';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';

const SESSION_TYPES = new Set<Database['public']['Enums']['session_type']>([
  'DRAFTING',
  'TRIAL_SESSION',
  'SUBSIDY_INTERVIEW',
]);

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const sessionType = params.get('session_type') as Database['public']['Enums']['session_type'] | null;
    const subjectId = params.get('subject_id');
    const duration = Number(params.get('duration_minutes') ?? '60');

    if (!startDate || !endDate || !sessionType || !SESSION_TYPES.has(sessionType)) {
      return NextResponse.json({ error: 'Invalid availability request' }, { status: 400 });
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const rangeDays = (end.getTime() - start.getTime()) / 86_400_000;
    if (!Number.isFinite(rangeDays) || rangeDays < 0 || rangeDays > 31) {
      return NextResponse.json({ error: 'Date range must be between 0 and 31 days' }, { status: 400 });
    }
    if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
      return NextResponse.json({ error: 'Invalid session duration' }, { status: 400 });
    }

    const { data, error } = await getServerSupabaseAdmin().rpc('get_available_slots', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_session_type: sessionType,
      p_subject_id: subjectId || undefined,
      p_duration_minutes: duration,
      p_bypass_date_restrictions: false,
    });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    captureApiError(error, '/api/bookings/availability');
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
