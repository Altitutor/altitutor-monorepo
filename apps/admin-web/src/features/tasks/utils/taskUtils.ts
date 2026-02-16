import type { TaskStatus, TaskPriority } from '../types';
import { formatDate } from '@/shared/utils/datetime';

/**
 * Get priority color classes
 */
export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 1: // Urgent
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 2: // High
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 3: // Medium
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 4: // Low
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default: // No priority
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

/**
 * Get priority label
 */
export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    default:
      return 'No priority';
  }
}

/**
 * Get status color classes
 */
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'backlog':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'todo':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'in_review':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'done':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

/**
 * Get status icon color class
 */
export function getStatusIconColor(status: TaskStatus): string {
  switch (status) {
    case 'backlog':
      return 'text-gray-500 dark:text-gray-400';
    case 'todo':
      return 'text-blue-500 dark:text-blue-400';
    case 'in_progress':
      return 'text-yellow-500 dark:text-yellow-400';
    case 'in_review':
      return 'text-purple-500 dark:text-purple-400';
    case 'done':
      return 'text-green-500 dark:text-green-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
}

/**
 * Get priority icon color class
 */
export function getPriorityIconColor(priority: TaskPriority): string {
  switch (priority) {
    case 1: // Urgent
      return 'text-red-500 dark:text-red-400';
    case 2: // High
      return 'text-orange-500 dark:text-orange-400';
    case 3: // Medium
      return 'text-yellow-500 dark:text-yellow-400';
    case 4: // Low
      return 'text-blue-500 dark:text-blue-400';
    default: // No priority
      return 'text-muted-foreground';
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'todo':
      return 'Todo';
    case 'in_progress':
      return 'In Progress';
    case 'in_review':
      return 'In Review';
    case 'done':
      return 'Done';
    default:
      return status;
  }
}

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
 * Get user initials
 */
export function getUserInitials(firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }
  return '?';
}

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

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

/**
 * Convert size label to estimate number (1-5)
 */
export function getEstimateValue(label: EstimateSize | null | undefined): number | null {
  if (!label) return null;
  return ESTIMATE_OPTIONS.find(opt => opt.label === label)?.value || null;
}

