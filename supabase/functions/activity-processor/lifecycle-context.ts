export type RecordData = Record<string, unknown>;

export const ENTITY_TABLES: Record<string, string> = {
  student: 'students', students: 'students', parent: 'parents', parents: 'parents',
  staff: 'staff', class: 'classes', classes: 'classes', session: 'sessions',
  sessions: 'sessions', task: 'tasks', tasks: 'tasks', issue: 'issues',
  issues: 'issues', project: 'projects', projects: 'projects', invoice: 'invoices',
  invoices: 'invoices', tutor_log: 'tutor_logs', tutor_logs: 'tutor_logs',
};

export function asRecord(value: unknown): RecordData {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordData
    : {};
}

export function lifecycleEventToAutomationContext(
  event: RecordData,
  linkedEntities: RecordData[]
): RecordData {
  const payload = asRecord(event.payload);
  const ids: RecordData = {};
  const genericRolePriority = new Map<string, number>();

  for (const link of linkedEntities) {
    const entityType = String(link.entity_type || '');
    const entityId = link.entity_id;
    const role = String(link.role || '');
    if (!entityType || typeof entityId !== 'string') continue;

    if (role) ids[`${role}_id`] = entityId;

    const genericKey = `${entityType}_id`;
    const rolePriority = role === 'subject' ? 3 : role === 'related' ? 2 : 1;
    if (rolePriority > (genericRolePriority.get(genericKey) || 0)) {
      ids[genericKey] = entityId;
      genericRolePriority.set(genericKey, rolePriority);
    }
  }

  const eventName = String(event.event_name || '');
  if (
    (eventName === 'session.staff_swapped' || eventName === 'session.staff_swap_reversed')
    && typeof ids.staff_in_id === 'string'
  ) {
    // Assignment/removal automations must target the replacement staff member,
    // while staff_out_id remains available for templates and future rules.
    ids.staff_id = ids.staff_in_id;
  }

  const subjectType = String(event.subject_type || '');
  const subjectTable = ENTITY_TABLES[subjectType] || subjectType;
  const tutorLogId = typeof payload.tutor_log_id === 'string' ? payload.tutor_log_id : null;

  return {
    ...ids,
    id: event.id,
    domain_event_id: event.id,
    event_name: event.event_name,
    event_type: event.event_name,
    entity_type: tutorLogId ? 'tutor_logs' : subjectTable,
    entity_id: tutorLogId || event.subject_id,
    subject_type: subjectType,
    subject_id: event.subject_id,
    performed_at: event.recorded_at,
    effective_at: event.effective_at,
    performed_by: event.actor_staff_id,
    metadata: payload,
    changed_fields: asRecord(payload.changes),
  };
}
