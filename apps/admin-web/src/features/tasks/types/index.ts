import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { JSONContent } from '@altitutor/ui';

/**
 * Task status types
 */
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

/**
 * Form values for create/edit task dialogs (aligned with task form schema).
 */
export interface TaskFormData {
  title: string;
  description?: JSONContent | null;
  status: TaskStatus;
  priority: number;
  assignedTo: string | null;
  issueId: string | null;
  estimate: number | null;
  dueDate: string | null;
}

/**
 * Task priority types
 * 0 = No priority (default, gray)
 * 1 = Urgent (red)
 * 2 = High (orange)
 * 3 = Medium (yellow)
 * 4 = Low (blue)
 */
export type TaskPriority = 0 | 1 | 2 | 3 | 4;

/**
 * Task type from database
 */
export type Task = Tables<'tasks'>;

/**
 * Task insert type
 */
export type TaskInsert = TablesInsert<'tasks'>;

/**
 * Task update type
 */
export type TaskUpdate = TablesUpdate<'tasks'>;

/**
 * Task filters for queries
 */
export interface TaskFilters {
  status?: TaskStatus[];
  assignedTo?: string | string[]; // Support both single and array for backward compatibility
  assignee?: string | string[];   // Support UI key
  assigned_to?: string | string[]; // Support database column name key
  issue_id?: string | string[];
  priority?: TaskPriority | TaskPriority[]; // Support both single and array for backward compatibility
  search?: string;
  [key: string]: unknown;
}

/**
 * Task with related staff data
 */
export interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  issue?: {
    id: string;
    name: string | null;
  } | null;
}
