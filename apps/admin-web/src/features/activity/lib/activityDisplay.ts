import type { ActivityEvent } from '../types';

export type ActivityDisplaySnapshot = {
  performed_by_name?: string;
  student_name?: string;
  staff_name?: string;
  class_name?: string;
  session_name?: string;
  parent_name?: string;
  task_title?: string;
  issue_name?: string;
  project_name?: string;
  subject_name?: string;
  topic_name?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function getActivityDisplaySnapshot(
  event: Pick<ActivityEvent, 'metadata'>
): ActivityDisplaySnapshot | null {
  const metadata = asRecord(event.metadata);
  if (!metadata) return null;
  const display = asRecord(metadata.display);
  if (!display) return null;

  const snapshot: ActivityDisplaySnapshot = {};
  for (const [key, value] of Object.entries(display)) {
    if (typeof value === 'string' && value.trim() !== '') {
      snapshot[key as keyof ActivityDisplaySnapshot] = value;
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

export function eventHasDisplaySnapshot(event: Pick<ActivityEvent, 'metadata'>): boolean {
  return getActivityDisplaySnapshot(event) !== null;
}
