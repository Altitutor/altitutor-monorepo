import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Clock3,
  Eye,
  Flag,
} from 'lucide-react';

// Shared priority scale used by tasks and projects
export type EntityPriority = 0 | 1 | 2 | 3 | 4;

type PriorityMeta = {
  value: EntityPriority;
  label: string;
  badgeColor: string;
  iconColor: string;
  icon: LucideIcon;
};

export const PRIORITY_OPTIONS: PriorityMeta[] = [
  {
    value: 0,
    label: 'No priority',
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    iconColor: 'text-muted-foreground',
    icon: Circle,
  },
  {
    value: 1,
    label: 'Urgent',
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    iconColor: 'text-red-500 dark:text-red-400',
    icon: AlertCircle,
  },
  {
    value: 2,
    label: 'High',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    iconColor: 'text-orange-500 dark:text-orange-400',
    icon: AlertTriangle,
  },
  {
    value: 3,
    label: 'Medium',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    icon: AlertCircle,
  },
  {
    value: 4,
    label: 'Low',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: CheckCircle,
  },
];

export function getPriorityLabel(priority: EntityPriority): string {
  return PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.label ?? 'No priority';
}

export function getPriorityColor(priority: EntityPriority): string {
  return PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.badgeColor ?? PRIORITY_OPTIONS[0].badgeColor;
}

export function getPriorityIconColor(priority: EntityPriority): string {
  return PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.iconColor ?? PRIORITY_OPTIONS[0].iconColor;
}

export function getPriorityIcon(priority: EntityPriority): LucideIcon {
  return PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.icon ?? PRIORITY_OPTIONS[0].icon;
}

// Task status
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

type TaskStatusMeta = {
  value: TaskStatus;
  label: string;
  badgeColor: string;
  iconColor: string;
  icon: LucideIcon;
};

export const TASK_STATUS_OPTIONS: TaskStatusMeta[] = [
  {
    value: 'backlog',
    label: 'Backlog',
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    iconColor: 'text-gray-500 dark:text-gray-400',
    icon: Circle,
  },
  {
    value: 'todo',
    label: 'Todo',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: Circle,
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    icon: Clock,
  },
  {
    value: 'in_review',
    label: 'In Review',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    iconColor: 'text-purple-500 dark:text-purple-400',
    icon: Eye,
  },
  {
    value: 'done',
    label: 'Done',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    iconColor: 'text-green-500 dark:text-green-400',
    icon: CheckCircle,
  },
];

export function getTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export function getTaskStatusColor(status: TaskStatus): string {
  return TASK_STATUS_OPTIONS.find((opt) => opt.value === status)?.badgeColor ?? TASK_STATUS_OPTIONS[0].badgeColor;
}

export function getTaskStatusIconColor(status: TaskStatus): string {
  return TASK_STATUS_OPTIONS.find((opt) => opt.value === status)?.iconColor ?? TASK_STATUS_OPTIONS[0].iconColor;
}

export function getTaskStatusIcon(status: TaskStatus): LucideIcon {
  return TASK_STATUS_OPTIONS.find((opt) => opt.value === status)?.icon ?? TASK_STATUS_OPTIONS[0].icon;
}

// Issue status
export type IssueStatus = 'open' | 'awaiting_response' | 'resolved';

type IssueStatusMeta = {
  value: IssueStatus;
  label: string;
  badgeColor: string;
  iconColor: string;
  icon: LucideIcon;
};

export const ISSUE_STATUS_OPTIONS: IssueStatusMeta[] = [
  {
    value: 'open',
    label: 'Open',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: Circle,
  },
  {
    value: 'awaiting_response',
    label: 'Awaiting Response',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    icon: Clock,
  },
  {
    value: 'resolved',
    label: 'Resolved',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    iconColor: 'text-green-500 dark:text-green-400',
    icon: CheckCircle,
  },
];

export function getIssueStatusLabel(status: IssueStatus): string {
  return ISSUE_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export function getIssueStatusColor(status: IssueStatus): string {
  return ISSUE_STATUS_OPTIONS.find((opt) => opt.value === status)?.badgeColor ?? ISSUE_STATUS_OPTIONS[0].badgeColor;
}

export function getIssueStatusIconColor(status: IssueStatus): string {
  return ISSUE_STATUS_OPTIONS.find((opt) => opt.value === status)?.iconColor ?? ISSUE_STATUS_OPTIONS[0].iconColor;
}

export function getIssueStatusIcon(status: IssueStatus): LucideIcon {
  return ISSUE_STATUS_OPTIONS.find((opt) => opt.value === status)?.icon ?? ISSUE_STATUS_OPTIONS[0].icon;
}

// Project status
export type ProjectStatus = 'backlog' | 'planned' | 'in_progress' | 'completed';

type ProjectStatusMeta = {
  value: ProjectStatus;
  label: string;
  badgeColor: string;
  iconColor: string;
  icon: LucideIcon;
};

export const PROJECT_STATUS_OPTIONS: ProjectStatusMeta[] = [
  {
    value: 'backlog',
    label: 'Backlog',
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    iconColor: 'text-muted-foreground',
    icon: Circle,
  },
  {
    value: 'planned',
    label: 'Planned',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: Clock3,
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    icon: Flag,
  },
  {
    value: 'completed',
    label: 'Completed',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    iconColor: 'text-green-500 dark:text-green-400',
    icon: CheckCircle2,
  },
];

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export function getProjectStatusColor(status: ProjectStatus): string {
  return PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status)?.badgeColor ?? PROJECT_STATUS_OPTIONS[0].badgeColor;
}

export function getProjectStatusIconColor(status: ProjectStatus): string {
  return PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status)?.iconColor ?? PROJECT_STATUS_OPTIONS[0].iconColor;
}

export function getProjectStatusIcon(status: ProjectStatus): LucideIcon {
  return PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status)?.icon ?? PROJECT_STATUS_OPTIONS[0].icon;
}

