import type { IssueStatus } from '../types';
import {
  getIssueStatusColor as getSharedIssueStatusColor,
  getIssueStatusLabel as getSharedIssueStatusLabel,
  getIssueStatusIcon as getSharedIssueStatusIcon,
  getIssueStatusIconColor as getSharedIssueStatusIconColor,
  ISSUE_STATUS_OPTIONS as SHARED_ISSUE_STATUS_OPTIONS,
} from '@/shared/constants';

export const ISSUE_STATUS_OPTIONS = SHARED_ISSUE_STATUS_OPTIONS;

export const getIssueStatusColor = (status: IssueStatus): string =>
  getSharedIssueStatusColor(status);

export const getIssueStatusLabel = (status: IssueStatus): string =>
  getSharedIssueStatusLabel(status);

export const getIssueStatusIcon = (status: IssueStatus) =>
  getSharedIssueStatusIcon(status);

export const getIssueStatusIconColor = (status: IssueStatus): string =>
  getSharedIssueStatusIconColor(status);

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
