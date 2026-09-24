import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

const ADELAIDE_TIMEZONE = 'Australia/Adelaide';

export function adminMeetingStartAtToDate(startAt: string): Date | null {
  const instant = new Date(startAt);
  if (Number.isNaN(instant.getTime())) return null;

  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

  return new Date(`${ymd}T00:00:00`);
}

export async function fetchLastAdminMeetingDate(now = new Date()): Promise<Date | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('sessions')
    .select('start_at')
    .eq('type', 'ADMIN_MEETING')
    .eq('status', 'ACTIVE')
    .not('start_at', 'is', null)
    .lte('start_at', now.toISOString())
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.start_at) return null;
  return adminMeetingStartAtToDate(data.start_at);
}
