import { formatActivityTimestamp, formatDate } from '@/shared/utils/datetime';
import type {
  ActivityEvent,
  ActivityEventDisplay,
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

function displayName(payload: Payload, entityType: string): string | undefined {
  return text(asRecord(payload.display)[`${entityType}_name`]);
}

function sentenceName(name: string | undefined, fallback: string): string {
  return name || fallback;
}

function formatSession(payload: Payload): string {
  const name = displayName(payload, 'session');
  if (name) return name;
  const session = asRecord(payload.session);
  const startAt = text(session.start_at) || text(payload.start_at);
  return startAt ? formatDate(startAt) : 'the session';
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

function changedFields(payload: Payload): ChangedField[] | undefined {
  const changes = asRecord(payload.changes);
  const fields = Object.entries(changes).flatMap(([fieldName, value]) => {
    const change = asRecord(value);
    const oldValue = change.old;
    const newValue = change.new;
    return [{
      fieldName,
      fieldLabel: titleCase(fieldName),
      oldValue: oldValue == null ? undefined : String(oldValue),
      newValue: newValue == null ? undefined : String(newValue),
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

function eventPresentation(eventName: string, payload: Payload): {
  message: string;
  icon: ActivityIconType;
  color: ActivityIconColor;
  fields?: ChangedField[];
} {
  const student = sentenceName(displayName(payload, 'student'), 'the student');
  const parent = sentenceName(displayName(payload, 'parent'), 'the parent');
  const staff = sentenceName(displayName(payload, 'staff'), 'the staff member');
  const task = sentenceName(displayName(payload, 'task'), 'the task');
  const session = formatSession(payload);

  const catalog: Record<string, [string, ActivityIconType, ActivityIconColor]> = {
    'student.created': ['created the student', 'user-plus', 'green'],
    'student.registered': ['registered the student', 'check', 'green'],
    'student.user_account_created': ['created the student user account', 'user-plus', 'green'],
    'student.payment_method_added': [`added ${paymentMethod(payload)}`, 'check', 'green'],
    'student.payment_method_removed': [`removed ${paymentMethod(payload)}`, 'x', 'red'],
    'student.discontinued': ['discontinued the student', 'user-minus', 'red'],
    'student.reactivated': ['reactivated the student', 'user-plus', 'green'],
    'student.deleted': ['deleted the student', 'x', 'red'],
    'student.parent_linked': [`linked ${parent}`, 'user-plus', 'green'],
    'student.parent_unlinked': [`unlinked ${parent}`, 'user-minus', 'red'],

    'staff.created': ['created the staff member', 'user-plus', 'green'],
    'staff.user_account_created': ['created the staff user account', 'user-plus', 'green'],
    'staff.status_changed': ['changed status', 'user-edit', 'blue'],
    'staff.deleted': ['deleted the staff member', 'user-minus', 'red'],

    'class.created': ['created the class', 'class-plus', 'green'],
    'class.schedule_updated': ['updated the class schedule', 'class-edit', 'blue'],
    'class.status_changed': ['changed status', 'class-edit', 'blue'],
    'class.deleted': ['deleted the class', 'x', 'red'],
    'class.student_added': [`added ${student} to the class`, 'user-plus', 'green'],
    'class.student_removed': [`removed ${student} from the class`, 'user-minus', 'red'],
    'class.staff_added': [`added ${staff} to the class`, 'user-plus', 'green'],
    'class.staff_removed': [`removed ${staff} from the class`, 'user-minus', 'red'],

    'admin_shift.created': ['created the admin shift', 'session-plus', 'green'],
    'admin_shift.schedule_updated': ['updated the admin shift schedule', 'session-edit', 'blue'],
    'admin_shift.status_changed': ['changed status', 'session-edit', 'blue'],
    'admin_shift.staff_added': [`added ${staff} to the admin shift`, 'user-plus', 'green'],
    'admin_shift.staff_removed': [`removed ${staff} from the admin shift`, 'user-minus', 'red'],
    'admin_shift.deleted': ['deleted the admin shift', 'x', 'red'],

    'session.created': [`created ${session}`, 'session-plus', 'green'],
    'session.schedule_updated': [`updated ${session}`, 'session-edit', 'blue'],
    'session.status_changed': ['changed status', 'session-edit', 'blue'],
    'session.logged': [`logged ${session}`, 'check', 'green'],
    'session.log_corrected': [`corrected the log for ${session}`, 'session-edit', 'blue'],
    'session.log_removed': [`removed the log for ${session}`, 'x', 'red'],
    'session.student_added': [`added ${student} to ${session}`, 'user-plus', 'green'],
    'session.student_removed': [`removed ${student} from ${session}`, 'user-minus', 'red'],
    'session.staff_added': [`added ${staff} to ${session}`, 'user-plus', 'green'],
    'session.staff_removed': [`removed ${staff} from ${session}`, 'user-minus', 'red'],
    'session.parent_added': [`added ${parent} to ${session}`, 'user-plus', 'green'],
    'session.parent_removed': [`removed ${parent} from ${session}`, 'user-minus', 'red'],
    'session.student_attended': [`recorded ${student} as attended`, 'check', 'green'],
    'session.student_absent': [`recorded ${student} as absent`, 'x', 'red'],
    'session.student_attendance_corrected': [`corrected ${student}'s attendance`, 'session-edit', 'blue'],
    'session.staff_attended': [`recorded ${staff} as attended`, 'check', 'green'],
    'session.staff_absent': [`recorded ${staff} as absent`, 'x', 'red'],
    'session.staff_attendance_corrected': [`corrected ${staff}'s attendance`, 'session-edit', 'blue'],
    'session.parent_attended': [`recorded ${parent} as attended`, 'check', 'green'],
    'session.parent_absent': [`recorded ${parent} as absent`, 'x', 'red'],
    'session.parent_attendance_corrected': [`corrected ${parent}'s attendance`, 'session-edit', 'blue'],
    'session.student_absence_recorded': [`recorded ${student}'s planned absence`, 'x', 'yellow'],
    'session.student_absence_cleared': [`cleared ${student}'s planned absence`, 'check', 'green'],
    'session.file_added': [`added ${text(payload.display_name) || 'a file'}`, 'file', 'green'],
    'session.file_removed': [`removed ${text(payload.display_name) || 'a file'}`, 'file', 'red'],
    'session.deleted': ['deleted the session', 'x', 'red'],

    'invoice.issued': ['issued an invoice', 'file', 'blue'],
    'invoice.paid': ['recorded the invoice as paid', 'check', 'green'],
    'invoice.payment_failed': ['recorded a failed invoice payment', 'x', 'red'],
    'invoice.voided': ['voided the invoice', 'x', 'red'],
    'invoice.refunded': ['refunded the invoice', 'arrow-left', 'purple'],
    'invoice.credit_note_added': [`added a ${titleCase(text(payload.credit_note_type) || 'credit')} credit note`, 'file', 'purple'],
    'invoice.credit_note_voided': ['voided the credit note', 'x', 'red'],

    'task.created': [`created ${task}`, 'flag', 'green'],
    'task.status_changed': ['changed status', 'flag', 'blue'],
    'task.assignee_changed': ['changed assignee', 'user-edit', 'blue'],
    'task.properties_changed': ['changed', 'flag', 'blue'],
    'task.deleted': ['deleted the task', 'x', 'red'],
    'issue.created': ['created the issue', 'flag', 'green'],
    'issue.status_changed': ['changed status', 'flag', 'blue'],
    'issue.properties_changed': ['changed', 'flag', 'blue'],
    'issue.task_linked': [`linked ${task}`, 'arrow-right', 'blue'],
    'issue.task_unlinked': [`unlinked ${task}`, 'arrow-left', 'gray'],
    'issue.deleted': ['deleted the issue', 'x', 'red'],
    'project.created': ['created the project', 'flag', 'green'],
    'project.status_changed': ['changed status', 'flag', 'blue'],
    'project.lead_changed': ['changed project lead', 'user-edit', 'blue'],
    'project.properties_changed': ['changed', 'flag', 'blue'],
    'project.task_linked': [`linked ${task}`, 'arrow-right', 'blue'],
    'project.task_unlinked': [`unlinked ${task}`, 'arrow-left', 'gray'],
    'project.deleted': ['deleted the project', 'x', 'red'],

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
    return { id: event.actor_staff_id, name: text(display.actor_name) || 'Staff' };
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
  const presentation = eventPresentation(event.event_name, payload);
  const effectiveAt = event.effective_at || event.recorded_at;
  return {
    id: event.id,
    icon: presentation.icon,
    iconColor: presentation.color,
    message: presentation.message,
    timestamp: formatActivityTimestamp(effectiveAt),
    performedAt: effectiveAt,
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
