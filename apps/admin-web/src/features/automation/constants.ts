import type { ActivityEntityType, ActivityEventType } from './types';

export const ENTITY_TYPES: { value: ActivityEntityType; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'students', label: 'Students' },
  { value: 'classes', label: 'Classes' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'staff', label: 'Staff' },
  { value: 'parents', label: 'Parents' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'invoice_items', label: 'Invoice Items' },
  { value: 'notes', label: 'Notes' },
  { value: 'tutor_logs', label: 'Tutor Logs' },
];

export const EVENT_TYPES: { value: ActivityEventType; label: string }[] = [
  { value: 'CREATED', label: 'Created' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
];

// For display purposes (Record format)
export const ENTITY_TYPES_DISPLAY: Record<string, string> = {
  tasks: 'Tasks',
  students: 'Students',
  classes: 'Classes',
  sessions: 'Sessions',
  staff: 'Staff',
  parents: 'Parents',
  invoices: 'Invoices',
  invoice_items: 'Invoice Items',
  notes: 'Notes',
  tutor_logs: 'Tutor Logs',
};

export const EVENT_TYPES_DISPLAY: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  DELETED: 'Deleted',
};
