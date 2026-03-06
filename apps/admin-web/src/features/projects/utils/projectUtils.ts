import type { ProjectPriority, ProjectStatus } from '../types';

/**
 * Get badge color classes for project status (for consistent card display)
 */
export function getProjectStatusColor(status: ProjectStatus): string {
  switch (status) {
    case 'backlog':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'planned':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'planned':
      return 'Planned';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

export function getProjectStatusOrder(status: string): number {
  const order: Record<string, number> = {
    backlog: 0,
    planned: 1,
    in_progress: 2,
    completed: 3,
    __null__: 999,
  };

  return order[status] ?? 999;
}

export function getProjectPriorityLabel(priority: ProjectPriority): string {
  switch (priority) {
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    case 0:
    default:
      return 'No priority';
  }
}

/**
 * Get badge color classes for project priority (matches task priority styling)
 */
export function getProjectPriorityColor(priority: ProjectPriority): string {
  switch (priority) {
    case 1:
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 2:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 3:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 4:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 0:
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export function formatProjectDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
