import { getSupabaseClient } from '@/shared/lib/supabase/client';

/** Existing reconciliation rules, with at least one future active session. */
export async function getUpcomingUnassignedClassIds(): Promise<Set<string>> {
  const db = getSupabaseClient();
  const ids = new Set<string>();
  const now = new Date().toISOString();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('vadmin_reconciliation_unassigned_classes')
      .select('class_id').order('class_id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    const classIds = data.flatMap((row) => row.class_id ? [row.class_id] : []);
    // Keep GET URLs small while checking for a matching session at the database.
    for (let index = 0; index < classIds.length; index += 100) {
      const { data: classes, error: sessionError } = await db.from('classes')
        .select('id, sessions!inner(id)').in('id', classIds.slice(index, index + 100))
        .eq('status', 'ACTIVE').eq('sessions.status', 'ACTIVE').gt('sessions.start_at', now)
        .limit(1, { referencedTable: 'sessions' });
      if (sessionError) throw sessionError;
      for (const row of classes) ids.add(row.id);
    }
    if (data.length < pageSize) return ids;
  }
}
