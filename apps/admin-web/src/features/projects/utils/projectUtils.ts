import type { ProjectPriority, ProjectStatus } from '../types';

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

export function formatProjectDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
