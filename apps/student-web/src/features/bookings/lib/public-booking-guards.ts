import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';
import type { Database } from '@altitutor/shared';

export { getAdelaideDateString, isWithinMinAdvanceThreshold } from './public-booking-threshold';

export const PUBLIC_BOOKING_SESSION_TYPES = ['TRIAL_SESSION', 'SUBSIDY_INTERVIEW'] as const;

export type PublicBookingSessionType = (typeof PUBLIC_BOOKING_SESSION_TYPES)[number];

export interface PublicBookingSessionRecord {
  id: string;
  start_at: string;
  end_at: string;
  type: PublicBookingSessionType;
  status: string;
  subject_id: string | null;
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  student_email: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isPublicBookingSessionType(
  value: string
): value is PublicBookingSessionType {
  return (PUBLIC_BOOKING_SESSION_TYPES as readonly string[]).includes(value);
}

export function createServiceRoleClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Server configuration error');
  }
  return instrumentSupabaseClient(createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }));
}

export async function getMinAdvanceBookingDays(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data } = await supabase
    .from('booking_settings')
    .select('setting_value')
    .eq('setting_key', 'min_advance_booking_days')
    .maybeSingle();

  const parsed = data?.setting_value ? parseInt(data.setting_value, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

export async function loadPublicBookingSession(
  supabase: SupabaseClient<Database>,
  publicIdentifier: string
): Promise<PublicBookingSessionRecord | null> {
  if (await isPublicBookingIdentifierRevoked(supabase, publicIdentifier)) {
    return null;
  }

  const identifierColumn = isValidUuid(publicIdentifier)
    ? 'id'
    : 'booking_public_token';
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, start_at, end_at, type, status, subject_id')
    .eq(identifierColumn, publicIdentifier)
    .single();

  if (sessionError || !session || !isPublicBookingSessionType(session.type)) {
    return null;
  }

  if (!session.start_at || !session.end_at) {
    return null;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('sessions_students')
    .select('student_id')
    .eq('session_id', session.id)
    .eq('planned_absence', false)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return null;
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, email')
    .eq('id', enrollment.student_id)
    .single();

  if (studentError || !student) {
    return null;
  }

  return {
    id: session.id,
    start_at: session.start_at,
    end_at: session.end_at,
    type: session.type,
    status: session.status,
    subject_id: session.subject_id,
    student_id: student.id,
    student_first_name: student.first_name ?? '',
    student_last_name: student.last_name ?? '',
    student_email: student.email,
  };
}

export async function isPublicBookingIdentifierRevoked(
  supabase: SupabaseClient<Database>,
  publicIdentifier: string
): Promise<boolean> {
  const { data } = await supabase
    .from('public_link_revocations')
    .select('token')
    .eq('purpose', 'BOOKING')
    .eq('token', publicIdentifier)
    .maybeSingle();

  return Boolean(data);
}

export function getBookingConfirmationUrl(publicToken: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_STUDENT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://student.altitutor.com';
  return `${baseUrl.replace(/\/$/, '')}/b/${publicToken}`;
}

export function formatSessionDateTime(startAt: string, endAt: string): {
  sessionDate: string;
  sessionTime: string;
} {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sessionDate = start.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Adelaide',
  });
  const startTime = start.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Adelaide',
  });
  const endTime = end.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Adelaide',
  });
  return { sessionDate, sessionTime: `${startTime} - ${endTime}` };
}
