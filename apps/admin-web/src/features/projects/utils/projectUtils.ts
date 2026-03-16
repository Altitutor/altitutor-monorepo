import type { ProjectPriority, ProjectStatus } from '../types';
import {
  getPriorityColor as getSharedPriorityColor,
  getPriorityIcon as getSharedPriorityIcon,
  getPriorityIconColor as getSharedPriorityIconColor,
  getPriorityLabel as getSharedPriorityLabel,
  getProjectStatusColor as getSharedProjectStatusColor,
  getProjectStatusIcon as getSharedProjectStatusIcon,
  getProjectStatusIconColor as getSharedProjectStatusIconColor,
  getProjectStatusLabel as getSharedProjectStatusLabel,
  PRIORITY_OPTIONS as SHARED_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS as SHARED_PROJECT_STATUS_OPTIONS,
} from '@/shared/constants';

export const PROJECT_STATUS_OPTIONS = SHARED_PROJECT_STATUS_OPTIONS;

export const PRIORITY_OPTIONS = SHARED_PRIORITY_OPTIONS.map(({ value, label }) => ({
  value: value as ProjectPriority,
  label,
}));

export const getProjectStatusColor = (status: ProjectStatus): string =>
  getSharedProjectStatusColor(status);

export const getProjectStatusLabel = (status: ProjectStatus): string =>
  getSharedProjectStatusLabel(status);

export const getProjectStatusIconColor = (status: ProjectStatus): string =>
  getSharedProjectStatusIconColor(status);

export const getProjectStatusIcon = (status: ProjectStatus) =>
  getSharedProjectStatusIcon(status);

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
  return getSharedPriorityLabel(priority);
}

export const getProjectPriorityColor = (priority: ProjectPriority): string =>
  getSharedPriorityColor(priority);

export const getProjectPriorityIconColor = (priority: ProjectPriority): string =>
  getSharedPriorityIconColor(priority);

export const getProjectPriorityIcon = (priority: ProjectPriority) =>
  getSharedPriorityIcon(priority);

export function formatProjectDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
