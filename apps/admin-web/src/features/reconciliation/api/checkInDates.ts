import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export type CheckInEntity = 'student' | 'parent' | 'staff';

export async function loadCheckInDates(db: SupabaseClient<Database>, kind: CheckInEntity) {
  const result: Record<string, string> = {};
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await db.from('tutor_logs').select(`
      sessions ( start_at ),
      tutor_logs_staff_attendance ( staff_id, attended ),
      tutor_logs_student_attendance ( student_id, attended ),
      tutor_logs_parent_attendance ( parent_id, attended )
    `).eq('session_type', 'CHECK_IN').order('id').range(offset, offset + size - 1);
    if (error) throw error;
    for (const log of data) {
      const date = log.sessions?.start_at;
      if (!date) continue;
      const attendees = kind === 'staff' ? log.tutor_logs_staff_attendance.map((row) => [row.staff_id, row.attended] as const)
        : kind === 'student' ? log.tutor_logs_student_attendance.map((row) => [row.student_id, row.attended] as const)
          : log.tutor_logs_parent_attendance.map((row) => [row.parent_id, row.attended] as const);
      for (const [id, attended] of attendees) {
        if (attended && (!result[id] || Date.parse(date) > Date.parse(result[id]))) result[id] = date;
      }
    }
    if (data.length < size) return result;
  }
}

export function compareTimeSinceCheckIn(left: string | undefined, right: string | undefined, ascending: boolean) {
  if (!left && !right) return 0;
  if (!left) return ascending ? 1 : -1;
  if (!right) return ascending ? -1 : 1;
  return (Date.parse(right) - Date.parse(left)) * (ascending ? 1 : -1);
}
