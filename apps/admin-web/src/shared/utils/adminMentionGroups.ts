import { recordEntities } from '@/features/command-palette/model';

export const adminMentionGroupByType = {
  email: 'emails', message: 'messages', student: 'students', staff: 'staff', parent: 'parents',
  class: 'classes', session: 'sessions', subject: 'subjects', task: 'tasks', issue: 'issues',
  project: 'projects', topic: 'topics', file: 'files', note: 'notes', invoice: 'invoices',
  adminShift: 'adminShifts', tutorLog: 'tutorLogs',
} as const satisfies Record<keyof typeof recordEntities, string>;

export type AdminMentionGroup = typeof adminMentionGroupByType[keyof typeof adminMentionGroupByType];
export const ADMIN_MENTION_GROUPS = Object.values(adminMentionGroupByType);

export const adminMentionTypeByGroup = Object.fromEntries(
  Object.entries(adminMentionGroupByType).map(([type, group]) => [group, type]),
) as Record<AdminMentionGroup, keyof typeof recordEntities>;
