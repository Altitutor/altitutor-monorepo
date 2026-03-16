import type { TaskStatus, TaskPriority } from '../types';
import { formatDate } from '@/shared/utils/datetime';
import {
  getPriorityColor as getSharedPriorityColor,
  getPriorityIcon as getSharedPriorityIcon,
  getPriorityIconColor as getSharedPriorityIconColor,
  getPriorityLabel as getSharedPriorityLabel,
  getTaskStatusColor as getSharedTaskStatusColor,
  getTaskStatusIcon as getSharedTaskStatusIcon,
  getTaskStatusIconColor as getSharedTaskStatusIconColor,
  getTaskStatusLabel as getSharedTaskStatusLabel,
  PRIORITY_OPTIONS as SHARED_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS as SHARED_TASK_STATUS_OPTIONS,
} from '@/shared/constants';

export const PRIORITY_OPTIONS = SHARED_PRIORITY_OPTIONS.map(({ value, label }) => ({ value: value as TaskPriority, label }));

export const TASK_STATUS_OPTIONS = SHARED_TASK_STATUS_OPTIONS;

export const getPriorityColor = (priority: TaskPriority): string =>
  getSharedPriorityColor(priority);

export const getPriorityLabel = (priority: TaskPriority): string =>
  getSharedPriorityLabel(priority);

export const getPriorityIconColor = (priority: TaskPriority): string =>
  getSharedPriorityIconColor(priority);

export const getPriorityIcon = (priority: TaskPriority) =>
  getSharedPriorityIcon(priority);

export const getStatusColor = (status: TaskStatus): string =>
  getSharedTaskStatusColor(status);

export const getStatusLabel = (status: TaskStatus): string =>
  getSharedTaskStatusLabel(status);

export const getStatusIconColor = (status: TaskStatus): string =>
  getSharedTaskStatusIconColor(status);

export const getStatusIcon = (status: TaskStatus) =>
  getSharedTaskStatusIcon(status);

/**
 * Check if task is overdue
 */
export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/**
 * Format due date for display
 */
export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  return formatDate(new Date(dueDate));
}

/**
 * Get user initials (re-exported from shared for backwards compatibility)
 */
export { getUserInitials } from '@/shared/utils/userHelpers';

/**
 * Estimate size options mapping
 */
export type EstimateSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export const ESTIMATE_OPTIONS: { value: number; label: EstimateSize }[] = [
  { value: 1, label: 'XS' },
  { value: 2, label: 'S' },
  { value: 3, label: 'M' },
  { value: 4, label: 'L' },
  { value: 5, label: 'XL' },
];

/**
 * Convert estimate number (1-5) to size label
 */
export function getEstimateLabel(estimate: number | null | undefined): EstimateSize | null {
  if (!estimate || estimate < 1 || estimate > 5) return null;
  return ESTIMATE_OPTIONS.find(opt => opt.value === estimate)?.label || null;
}

/**
 * Convert size label to estimate number (1-5)
 */
export function getEstimateValue(label: EstimateSize | null | undefined): number | null {
  if (!label) return null;
  return ESTIMATE_OPTIONS.find(opt => opt.label === label)?.value || null;
}

