import type { IssueStatus } from '../types';

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
