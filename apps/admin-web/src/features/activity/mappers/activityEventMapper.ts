import { formatActivityTimestamp, formatCompactDate, formatDate } from '@/shared/utils/datetime';
import type {
  ActivityEvent,
  ActivityEventDisplay,
  ActivityMessagePart,
  ActivityEventsResponse,
  ActivityIconColor,
  ActivityIconType,
  ChangedField,
} from '../types';

type Payload = Record<string, unknown>;

function asRecord(value: unknown): Payload {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Payload
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function entityNames(event: ActivityEvent, entityType: string): string[] {
  return event.entities
    .filter((entity) => entity.entityType === entityType && entity.displayName)
    .map((entity) => entity.displayName!)
    .filter((name, index, names) => names.indexOf(name) === index);
}

function entityNameByRole(event: ActivityEvent, role: string): string | undefined {
  return event.entities.find((entity) => entity.role === role)?.displayName || undefined;
}

function displayName(
  event: ActivityEvent,
  payload: Payload,
  entityType: string
): string | undefined {
  return entityNames(event, entityType)[0]
    || text(asRecord(payload.display)[`${entityType}_name`]);
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => text(item) || [])
    : [];
}

function displayNames(event: ActivityEvent, payload: Payload, entityType: string): string[] {
  const linkedNames = entityNames(event, entityType);
  if (linkedNames.length) return linkedNames;
  const display = asRecord(payload.display);
  const names = textArray(display[`${entityType}_names`]);
  const singleName = text(display[`${entityType}_name`]);
  return names.length ? names : singleName ? [singleName] : [];
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function sentenceName(name: string | undefined, fallback: string): string {
  return name || fallback;
}

function formatSession(event: ActivityEvent, payload: Payload): string {
  const name = displayName(event, payload, 'session');
  if (name) return name;
  const session = asRecord(payload.session);
  const startAt = text(session.start_at) || text(payload.start_at);
  return startAt ? formatDate(startAt) : 'the session';
}

function linkedMessageParts(event: ActivityEvent, message: string): ActivityMessagePart[] | undefined {
  const byName = new Map<string, ActivityEvent['entities'][number]>();
  for (const entity of event.entities) {
    if (entity.displayName && !byName.has(entity.displayName)) {
      byName.set(entity.displayName, entity);
    }
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  if (!names.length) return undefined;
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const segments = message.split(new RegExp(`(${escapedNames.join('|')})`, 'g'));
  const parts = segments.flatMap<ActivityMessagePart>((segment) => {
    if (!segment) return [];
    const entity = byName.get(segment);
    return entity
      ? [{ kind: 'entity', text: segment, entity }]
      : [{ kind: 'text', text: segment }];
  });
  return parts.some((part) => part.kind === 'entity') ? parts : undefined;
}

function paymentMethod(payload: Payload): string {
  const brand = text(payload.card_brand);
  const last4 = text(payload.card_last4);
  if (brand && last4) return `${brand} ending ${last4}`;
  if (last4) return `payment method ending ${last4}`;
  return 'payment method';
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const DATE_CHANGE_FIELDS = new Set(['birthday', 'due_date', 'start_date', 'target_date']);

function formatChangedValue(fieldName: string, value: unknown): string | undefined {
  if (value == null) return undefined;
  if (DATE_CHANGE_FIELDS.has(fieldName) && (typeof value === 'string' || value instanceof Date)) {
    return formatCompactDate(value) ?? String(value);
  }
  return String(value);
}

function changedFields(payload: Payload): ChangedField[] | undefined {
  const changes = asRecord(payload.changes);
  const fields = Object.entries(changes).flatMap(([fieldName, value]) => {
    const change = asRecord(value);
    const oldValue = change.old;
    const newValue = change.new;
    return [{
      fieldName,
      fieldLabel: titleCase(fieldName),
      oldValue: formatChangedValue(fieldName, oldValue),
      newValue: formatChangedValue(fieldName, newValue),
    }];
  });
  return fields.length ? fields : undefined;
}

function statusField(payload: Payload): ChangedField[] | undefined {
  if (payload.previous_status === undefined && payload.status === undefined) return undefined;
  return [{
    fieldName: 'status',
    fieldLabel: 'Status',
    oldValue: text(payload.previous_status),
    newValue: text(payload.status),
  }];
}

function eventPresentation(event: ActivityEvent, payload: Payload): {
  message: string;
  icon: ActivityIconType;
  color: ActivityIconColor;
  fields?: ChangedField[];
} {
  const eventName = event.event_name;
  const student = sentenceName(displayName(event, payload, 'student'), 'the student');
  const parent = sentenceName(displayName(event, payload, 'parent'), 'the parent');
  const staff = sentenceName(displayName(event, payload, 'staff'), 'the staff member');
  const className = sentenceName(displayName(event, payload, 'class'), 'the class');
  const adminShift = sentenceName(displayName(event, payload, 'admin_shift'), 'the admin shift');
  const task = sentenceName(displayName(event, payload, 'task'), 'the task');
  const issue = sentenceName(displayName(event, payload, 'issue'), 'the issue');
  const project = sentenceName(displayName(event, payload, 'project'), 'the project');
  const session = formatSession(event, payload);
  const staffOut = sentenceName(entityNameByRole(event, 'staff_out'), staff);
  const staffIn = sentenceName(entityNameByRole(event, 'staff_in'), 'the replacement staff member');
  const sessionFrom = sentenceName(entityNameByRole(event, 'session_from'), session);
  const sessionTo = sentenceName(entityNameByRole(event, 'session_to'), 'the replacement session');
  const invoiceNumber = displayName(event, payload, 'invoice');
  const invoice = invoiceNumber ? `invoice ${invoiceNumber}` : 'the invoice';
  const invoiceSessions = displayNames(event, payload, 'session');
  const invoiceWithSessions = invoiceSessions.length
    ? `${invoice} for ${formatList(invoiceSessions)}`
    : invoice;

  const catalog: Record<string, [string, ActivityIconType, ActivityIconColor]> = {
    'student.created': [`created ${student}`, 'user-plus', 'green'],
    'student.registered': [`registered ${student}`, 'check', 'green'],
    'student.user_account_created': [`created ${student}'s user account`, 'user-plus', 'green'],
    'student.payment_method_added': [`added ${paymentMethod(payload)}`, 'check', 'green'],
    'student.payment_method_removed': [`removed ${paymentMethod(payload)}`, 'x', 'red'],
    'student.properties_changed': [`changed ${student}`, 'user-edit', 'blue'],
    'student.discontinued': [`discontinued ${student}`, 'user-minus', 'red'],
    'student.reactivated': [`reactivated ${student}`, 'user-plus', 'green'],
    'student.deleted': [`deleted ${student}`, 'x', 'red'],
    'student.parent_linked': [`linked ${parent}`, 'user-plus', 'green'],
    'student.parent_unlinked': [`unlinked ${parent}`, 'user-minus', 'red'],

    'staff.created': [`created ${staff}`, 'user-plus', 'green'],
    'staff.user_account_created': [`created ${staff}'s user account`, 'user-plus', 'green'],
    'staff.status_changed': [`changed ${staff}'s status`, 'user-edit', 'blue'],
    'staff.deleted': [`deleted ${staff}`, 'user-minus', 'red'],

    'class.created': [`created ${className}`, 'class-plus', 'green'],
    'class.schedule_updated': [`updated ${className}'s schedule`, 'class-edit', 'blue'],
    'class.status_changed': [`changed ${className}'s status`, 'class-edit', 'blue'],
    'class.deleted': [`deleted ${className}`, 'x', 'red'],
    'class.student_added': [`added ${student} to ${className}`, 'user-plus', 'green'],
    'class.student_removed': [`removed ${student} from ${className}`, 'user-minus', 'red'],
    'class.staff_added': [`added ${staff} to ${className}`, 'user-plus', 'green'],
    'class.staff_removed': [`removed ${staff} from ${className}`, 'user-minus', 'red'],

    'admin_shift.created': [`created ${adminShift}`, 'session-plus', 'green'],
    'admin_shift.schedule_updated': [`updated ${adminShift}'s schedule`, 'session-edit', 'blue'],
    'admin_shift.status_changed': [`changed ${adminShift}'s status`, 'session-edit', 'blue'],
    'admin_shift.staff_added': [`added ${staff} to ${adminShift}`, 'user-plus', 'green'],
    'admin_shift.staff_removed': [`removed ${staff} from ${adminShift}`, 'user-minus', 'red'],
    'admin_shift.deleted': [`deleted ${adminShift}`, 'x', 'red'],

    'session.created': [`created ${session}`, 'session-plus', 'green'],
    'session.schedule_updated': [`updated ${session}`, 'session-edit', 'blue'],
    'session.status_changed': [`changed ${session}'s status`, 'session-edit', 'blue'],
    'session.logged': [`logged ${session}`, 'check', 'green'],
    'session.log_corrected': [`corrected the log for ${session}`, 'session-edit', 'blue'],
    'session.log_removed': [`removed the log for ${session}`, 'x', 'red'],
    'session.student_added': [`added ${student} to ${session}`, 'user-plus', 'green'],
    'session.student_removed': [`removed ${student} from ${session}`, 'user-minus', 'red'],
    'session.staff_added': [`added ${staff} to ${session}`, 'user-plus', 'green'],
    'session.staff_removed': [`removed ${staff} from ${session}`, 'user-minus', 'red'],
    'session.parent_added': [`added ${parent} to ${session}`, 'user-plus', 'green'],
    'session.parent_removed': [`removed ${parent} from ${session}`, 'user-minus', 'red'],
    'session.student_attended': [`recorded ${student} as attended at ${session}`, 'check', 'green'],
    'session.student_absent': [`recorded ${student} as absent from ${session}`, 'x', 'red'],
    'session.student_attendance_corrected': [`corrected ${student}'s attendance for ${session}`, 'session-edit', 'blue'],
    'session.staff_attended': [`recorded ${staff} as attended at ${session}`, 'check', 'green'],
    'session.staff_absent': [`recorded ${staff} as absent from ${session}`, 'x', 'red'],
    'session.staff_attendance_corrected': [`corrected ${staff}'s attendance for ${session}`, 'session-edit', 'blue'],
    'session.parent_attended': [`recorded ${parent} as attended at ${session}`, 'check', 'green'],
    'session.parent_absent': [`recorded ${parent} as absent from ${session}`, 'x', 'red'],
    'session.parent_attendance_corrected': [`corrected ${parent}'s attendance for ${session}`, 'session-edit', 'blue'],
    'session.student_absence_recorded': [`recorded ${student}'s planned absence from ${session}`, 'x', 'yellow'],
    'session.student_absence_cleared': [`cleared ${student}'s planned absence from ${session}`, 'check', 'green'],
    'session.student_rescheduled': [`rescheduled ${student} from ${sessionFrom} to ${sessionTo}`, 'arrow-right', 'blue'],
    'session.student_reschedule_reversed': [`reversed ${student}'s reschedule from ${sessionFrom} to ${sessionTo}`, 'arrow-left', 'gray'],
    'session.student_credited': [`credited ${student} for ${session}`, 'check', 'purple'],
    'session.student_credit_reversed': [`reversed ${student}'s credit for ${session}`, 'arrow-left', 'gray'],
    'session.staff_absence_recorded': [`recorded ${staff}'s planned absence from ${session}`, 'x', 'yellow'],
    'session.staff_absence_cleared': [`cleared ${staff}'s planned absence from ${session}`, 'check', 'green'],
    'session.staff_swapped': [`swapped ${staffOut} out for ${staffIn} in ${session}`, 'user-edit', 'blue'],
    'session.staff_swap_reversed': [`reversed the swap of ${staffOut} for ${staffIn} in ${session}`, 'arrow-left', 'gray'],
    'session.file_added': [`added ${text(payload.display_name) || 'a file'}`, 'file', 'green'],
    'session.file_removed': [`removed ${text(payload.display_name) || 'a file'}`, 'file', 'red'],
    'session.deleted': ['deleted the session', 'x', 'red'],

    'invoice.issued': [`issued ${invoiceWithSessions}`, 'file', 'blue'],
    'invoice.paid': [`recorded ${invoiceWithSessions} as paid`, 'check', 'green'],
    'invoice.payment_failed': [`recorded a failed payment for ${invoiceWithSessions}`, 'x', 'red'],
    'invoice.voided': [`voided ${invoiceWithSessions}`, 'x', 'red'],
    'invoice.refunded': [`refunded ${invoiceWithSessions}`, 'arrow-left', 'purple'],
    'invoice.credit_note_added': [`added a ${titleCase(text(payload.credit_note_type) || 'credit')} credit note to ${invoiceWithSessions}`, 'file', 'purple'],
    'invoice.credit_note_voided': [`voided the credit note for ${invoiceWithSessions}`, 'x', 'red'],

    'task.created': [`created ${task}`, 'flag', 'green'],
    'task.status_changed': [`changed ${task}'s status`, 'flag', 'blue'],
    'task.assignee_changed': [`changed ${task}'s assignee`, 'user-edit', 'blue'],
    'task.properties_changed': [`changed ${task}`, 'flag', 'blue'],
    'task.deleted': [`deleted ${task}`, 'x', 'red'],
    'issue.created': [`created ${issue}`, 'flag', 'green'],
    'issue.status_changed': [`changed ${issue}'s status`, 'flag', 'blue'],
    'issue.properties_changed': [`changed ${issue}`, 'flag', 'blue'],
    'issue.task_linked': [`linked ${task}`, 'arrow-right', 'blue'],
    'issue.task_unlinked': [`unlinked ${task}`, 'arrow-left', 'gray'],
    'issue.deleted': [`deleted ${issue}`, 'x', 'red'],
    'project.created': [`created ${project}`, 'flag', 'green'],
    'project.status_changed': [`changed ${project}'s status`, 'flag', 'blue'],
    'project.lead_changed': [`changed ${project}'s lead`, 'user-edit', 'blue'],
    'project.properties_changed': [`changed ${project}`, 'flag', 'blue'],
    'project.task_linked': [`linked ${task}`, 'arrow-right', 'blue'],
    'project.task_unlinked': [`unlinked ${task}`, 'arrow-left', 'gray'],
    'project.deleted': [`deleted ${project}`, 'x', 'red'],

    'note.added': ['added a note', 'note', 'gray'],
    'note.removed': ['removed a note', 'note', 'red'],
    'form.response_submitted': ['submitted a form response', 'file', 'green'],
    'form.response_removed': ['removed a form response', 'file', 'red'],
  };

  const [message, icon, color] = catalog[eventName] || [
    eventName.split('.').slice(1).join(' ').replace(/_/g, ' '),
    'default',
    'gray',
  ];
  const fields = eventName.endsWith('.status_changed')
    ? statusField(payload)
    : eventName.endsWith('.properties_changed')
      ? changedFields(payload)
      : undefined;
  return { message, icon, color, fields };
}

function resolvePerformer(event: ActivityEvent, payload: Payload): { id: string; name: string } {
  const display = asRecord(payload.display);
  const actorType = text(payload.actor_type);
  if (event.actor_staff_id) {
    return {
      id: event.actor_staff_id,
      name: text(display.actor_name) || event.actorName || 'Staff',
    };
  }
  if (actorType === 'student') {
    return { id: '', name: text(display.student_name) || 'Student' };
  }
  if (actorType === 'parent') {
    return { id: '', name: text(display.parent_name) || 'Parent' };
  }
  return { id: '', name: 'System' };
}

export function mapActivityEventToDisplay(
  event: ActivityEvent,
  ..._legacyArguments: unknown[]
): ActivityEventDisplay {
  const payload = asRecord(event.payload);
  const presentation = eventPresentation(event, payload);
  const recordedAt = event.recorded_at;
  return {
    id: event.id,
    icon: presentation.icon,
    iconColor: presentation.color,
    message: presentation.message,
    messageParts: linkedMessageParts(event, presentation.message),
    timestamp: formatActivityTimestamp(recordedAt),
    performedAt: recordedAt,
    performedBy: resolvePerformer(event, payload),
    metadata: payload,
    changedFields: presentation.fields,
    entityId: event.subject_id,
    entityType: event.subject_type === 'form_response' ? 'form_responses' : event.subject_type,
    eventType: event.event_name,
    noteContent: event.event_name === 'note.added'
      ? payload.note as Record<string, unknown> | string | undefined
      : undefined,
  };
}

export function mapActivityEventsToDisplay(
  response: ActivityEventsResponse
): ActivityEventDisplay[] {
  return response.events
    .map(mapActivityEventToDisplay)
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}
