import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

type Target = { contactId: string; studentId?: string };

/** Keep the Student context until after filtering, before shared-parent dedupe/retry. */
export async function filterLiveStudentMessageTargets(
  supabase: SupabaseClient,
  targets: Target[],
  contextStudentId?: string,
): Promise<Target[]> {
  if (!targets.length) return [];
  const ids = [...new Set([contextStudentId, ...targets.map(target => target.studentId)].filter((id): id is string => !!id))];
  if (!ids.length) return targets;
  const live = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from('students').select('id,deleted_at').in('id', ids.slice(offset, offset + 200));
    if (error) throw error;
    for (const student of data ?? []) if (student.deleted_at === null) live.add(student.id);
  }
  if (contextStudentId && !live.has(contextStudentId)) return [];
  return targets.filter(target => !target.studentId || live.has(target.studentId));
}
