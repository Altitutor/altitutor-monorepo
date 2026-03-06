import type { IssueStatus } from '../types';

/**
 * Get badge color classes for issue status (for consistent card display)
 */
export function getIssueStatusColor(status: IssueStatus): string {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'awaiting_response':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'resolved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export function getIssueStatusLabel(status: IssueStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'awaiting_response':
      return 'Awaiting Response';
    case 'resolved':
      return 'Resolved';
    default:
      return status;
  }
}

export function getIssueStatusOrder(status: string): number {
  const order: Record<string, number> = {
    open: 0,
    awaiting_response: 1,
    resolved: 2,
    __null__: 999,
  };

  return order[status] ?? 999;
}

export function isIssueOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function formatIssueDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  return new Date(dueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
