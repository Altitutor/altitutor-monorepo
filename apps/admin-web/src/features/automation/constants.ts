import type { ActivityEntityType, DomainEventName } from './types';

export const ENTITY_TYPES: { value: ActivityEntityType; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
  { value: 'staff', label: 'Staff' },
  { value: 'classes', label: 'Classes' },
  { value: 'admin_shifts', label: 'Admin shifts' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'issues', label: 'Issues' },
  { value: 'projects', label: 'Projects' },
  { value: 'form_responses', label: 'Form responses' },
  { value: 'notes', label: 'Notes' },
];

export interface DomainEventOption {
  value: DomainEventName;
  label: string;
  entityType: ActivityEntityType;
}

export const EVENT_NAMES: DomainEventOption[] = [
  { value: 'student.created', label: 'Student created', entityType: 'students' },
  { value: 'student.registered', label: 'Student registered', entityType: 'students' },
  { value: 'student.user_account_created', label: 'Student user account created', entityType: 'students' },
  { value: 'student.payment_method_added', label: 'Student payment method added', entityType: 'students' },
  { value: 'student.payment_method_removed', label: 'Student payment method removed', entityType: 'students' },
  { value: 'student.discontinued', label: 'Student discontinued', entityType: 'students' },
  { value: 'student.reactivated', label: 'Student reactivated', entityType: 'students' },
  { value: 'student.parent_linked', label: 'Parent linked to student', entityType: 'students' },
  { value: 'student.parent_unlinked', label: 'Parent unlinked from student', entityType: 'students' },

  { value: 'staff.created', label: 'Staff created', entityType: 'staff' },
  { value: 'staff.user_account_created', label: 'Staff user account created', entityType: 'staff' },
  { value: 'staff.status_changed', label: 'Staff status changed', entityType: 'staff' },

  { value: 'class.created', label: 'Class created', entityType: 'classes' },
  { value: 'class.schedule_updated', label: 'Class schedule updated', entityType: 'classes' },
  { value: 'class.status_changed', label: 'Class status changed', entityType: 'classes' },
  { value: 'class.student_added', label: 'Student added to class', entityType: 'classes' },
  { value: 'class.student_removed', label: 'Student removed from class', entityType: 'classes' },
  { value: 'class.staff_added', label: 'Staff added to class', entityType: 'classes' },
  { value: 'class.staff_removed', label: 'Staff removed from class', entityType: 'classes' },

  { value: 'admin_shift.created', label: 'Admin shift created', entityType: 'admin_shifts' },
  { value: 'admin_shift.schedule_updated', label: 'Admin shift schedule updated', entityType: 'admin_shifts' },
  { value: 'admin_shift.status_changed', label: 'Admin shift status changed', entityType: 'admin_shifts' },
  { value: 'admin_shift.staff_added', label: 'Staff added to admin shift', entityType: 'admin_shifts' },
  { value: 'admin_shift.staff_removed', label: 'Staff removed from admin shift', entityType: 'admin_shifts' },

  { value: 'session.created', label: 'Session created', entityType: 'sessions' },
  { value: 'session.schedule_updated', label: 'Session schedule updated', entityType: 'sessions' },
  { value: 'session.status_changed', label: 'Session status changed', entityType: 'sessions' },
  { value: 'session.logged', label: 'Session logged', entityType: 'sessions' },
  { value: 'session.log_corrected', label: 'Session log corrected', entityType: 'sessions' },
  { value: 'session.student_added', label: 'Student added to session', entityType: 'sessions' },
  { value: 'session.student_removed', label: 'Student removed from session', entityType: 'sessions' },
  { value: 'session.staff_added', label: 'Staff added to session', entityType: 'sessions' },
  { value: 'session.staff_removed', label: 'Staff removed from session', entityType: 'sessions' },
  { value: 'session.parent_added', label: 'Parent added to session', entityType: 'sessions' },
  { value: 'session.parent_removed', label: 'Parent removed from session', entityType: 'sessions' },
  { value: 'session.student_absence_recorded', label: 'Student planned absence recorded', entityType: 'sessions' },
  { value: 'session.student_absence_cleared', label: 'Student planned absence cleared', entityType: 'sessions' },
  { value: 'session.student_rescheduled', label: 'Student rescheduled', entityType: 'sessions' },
  { value: 'session.student_reschedule_reversed', label: 'Student reschedule reversed', entityType: 'sessions' },
  { value: 'session.student_credited', label: 'Student absence credited', entityType: 'sessions' },
  { value: 'session.student_credit_reversed', label: 'Student absence credit reversed', entityType: 'sessions' },
  { value: 'session.staff_absence_recorded', label: 'Staff planned absence recorded', entityType: 'sessions' },
  { value: 'session.staff_absence_cleared', label: 'Staff planned absence cleared', entityType: 'sessions' },
  { value: 'session.staff_swapped', label: 'Staff swapped', entityType: 'sessions' },
  { value: 'session.staff_swap_reversed', label: 'Staff swap reversed', entityType: 'sessions' },
  { value: 'session.student_attended', label: 'Student attended session', entityType: 'sessions' },
  { value: 'session.student_absent', label: 'Student absent from session', entityType: 'sessions' },
  { value: 'session.student_attendance_corrected', label: 'Student attendance corrected', entityType: 'sessions' },
  { value: 'session.staff_attended', label: 'Staff attended session', entityType: 'sessions' },
  { value: 'session.staff_absent', label: 'Staff absent from session', entityType: 'sessions' },
  { value: 'session.staff_attendance_corrected', label: 'Staff attendance corrected', entityType: 'sessions' },
  { value: 'session.parent_attended', label: 'Parent attended session', entityType: 'sessions' },
  { value: 'session.parent_absent', label: 'Parent absent from session', entityType: 'sessions' },
  { value: 'session.file_added', label: 'File added to session', entityType: 'sessions' },
  { value: 'session.file_removed', label: 'File removed from session', entityType: 'sessions' },

  { value: 'invoice.issued', label: 'Student invoiced', entityType: 'invoices' },
  { value: 'invoice.paid', label: 'Invoice paid', entityType: 'invoices' },
  { value: 'invoice.payment_failed', label: 'Invoice payment failed', entityType: 'invoices' },
  { value: 'invoice.voided', label: 'Invoice voided', entityType: 'invoices' },
  { value: 'invoice.refunded', label: 'Invoice refunded', entityType: 'invoices' },
  { value: 'invoice.credit_note_added', label: 'Credit note added', entityType: 'invoices' },
  { value: 'invoice.credit_note_voided', label: 'Credit note voided', entityType: 'invoices' },

  { value: 'task.created', label: 'Task created', entityType: 'tasks' },
  { value: 'task.status_changed', label: 'Task status changed', entityType: 'tasks' },
  { value: 'task.assignee_changed', label: 'Task assignee changed', entityType: 'tasks' },
  { value: 'task.properties_changed', label: 'Task properties changed', entityType: 'tasks' },
  { value: 'issue.created', label: 'Issue created', entityType: 'issues' },
  { value: 'issue.status_changed', label: 'Issue status changed', entityType: 'issues' },
  { value: 'issue.properties_changed', label: 'Issue properties changed', entityType: 'issues' },
  { value: 'issue.task_linked', label: 'Task linked to issue', entityType: 'issues' },
  { value: 'issue.task_unlinked', label: 'Task unlinked from issue', entityType: 'issues' },
  { value: 'project.created', label: 'Project created', entityType: 'projects' },
  { value: 'project.status_changed', label: 'Project status changed', entityType: 'projects' },
  { value: 'project.lead_changed', label: 'Project lead changed', entityType: 'projects' },
  { value: 'project.properties_changed', label: 'Project properties changed', entityType: 'projects' },
  { value: 'project.task_linked', label: 'Task linked to project', entityType: 'projects' },
  { value: 'project.task_unlinked', label: 'Task unlinked from project', entityType: 'projects' },

  { value: 'form.response_submitted', label: 'Form response submitted', entityType: 'form_responses' },
  { value: 'form.response_removed', label: 'Form response removed', entityType: 'form_responses' },
  { value: 'note.added', label: 'Note added', entityType: 'notes' },
  { value: 'note.removed', label: 'Note removed', entityType: 'notes' },
];

export const ENTITY_TYPES_DISPLAY = Object.fromEntries(
  ENTITY_TYPES.map((entity) => [entity.value, entity.label])
) as Record<string, string>;

export const EVENT_NAMES_DISPLAY = Object.fromEntries(
  EVENT_NAMES.map((event) => [event.value, event.label])
) as Record<string, string>;
