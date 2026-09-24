import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/** Choose materialised lessons, including custom/fortnightly timetables and exceptions. */
export function useClassTransferSessions(oldClassId: string, newClassId?: string) {
  return useQuery({
    queryKey: ['class-transfer-sessions', oldClassId, newClassId],
    enabled: !!oldClassId && !!newClassId,
    queryFn: async () => {
      const now = Date.now();
      const { data, error } = await getSupabaseClient()
        .from('sessions')
        .select('id, class_id, start_at, end_at, billing_type, subject_id')
        .in('class_id', [oldClassId, newClassId!])
        .eq('status', 'ACTIVE')
        .is('calendar_tombstone_until', null)
        .gte('start_at', new Date(now - 90 * 86400000).toISOString())
        .lte('start_at', new Date(now + 365 * 86400000).toISOString())
        .order('start_at')
        .limit(1000);
      if (error) throw error;
      return (data ?? []).flatMap(session => {
        const { class_id, start_at, end_at, subject_id } = session;
        return class_id && start_at && end_at && subject_id
          ? [{ ...session, class_id, start_at, end_at, subject_id }]
          : [];
      });
    },
  });
}

export function sessionCalendarDate(startAt: string, timezone = 'Australia/Adelaide'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(startAt));
}

export function sessionDateLabel(startAt: string, timezone = 'Australia/Adelaide'): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(startAt));
}
