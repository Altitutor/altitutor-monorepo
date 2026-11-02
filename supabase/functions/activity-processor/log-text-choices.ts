import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

type Target = { contactId: string; studentId?: string };

/** Apply the log's snapshot to every message action, including configured contacts.
 * A Student opt-out affects their own contact, never an independently attended parent.
 */
export async function filterTutorLogTextTargets(
  supabase: SupabaseClient,
  targets: Target[],
  event: Record<string, unknown>,
): Promise<Target[]> {
  if (!targets.length || (event.event_name ?? event.event_type) !== 'session.logged') return targets;
  if (event.entity_type !== 'tutor_logs' || typeof event.entity_id !== 'string') {
    throw new Error('Session log text choices require a tutor log identity');
  }
  const { data: log, error } = await supabase.from('tutor_logs')
    .select('automated_text_suppressed_student_ids, automated_text_suppressed_parent_ids')
    .eq('id', event.entity_id).single();
  if (error) throw error;
  if (!log) throw new Error('Cannot read session log text choices');
  const studentIds = new Set<string>(log.automated_text_suppressed_student_ids);
  const parentIds = new Set<string>(log.automated_text_suppressed_parent_ids);
  if (!studentIds.size && !parentIds.size) return targets;

  const contactIds = [...new Set(targets.map(target => target.contactId))];
  const allowed = new Set<string>();
  for (let offset = 0; offset < contactIds.length; offset += 200) {
    const { data: contacts, error: contactsError } = await supabase.from('contacts')
      .select('id, student_id, parent_id').in('id', contactIds.slice(offset, offset + 200));
    if (contactsError) throw contactsError;
    for (const contact of contacts ?? []) {
      if (!studentIds.has(contact.student_id) && !parentIds.has(contact.parent_id)) allowed.add(contact.id);
    }
  }
  return targets.filter(target => allowed.has(target.contactId));
}
