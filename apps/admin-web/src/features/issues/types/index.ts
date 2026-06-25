import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { JSONContent } from '@altitutor/ui';

/**
 * Issue status types
 */
export type IssueStatus = 'open' | 'awaiting_response' | 'resolved';

/**
 * Form values for create/edit issue dialogs (aligned with issue form schema).
 */
export interface IssueFormData {
  name: string;
  description?: JSONContent | null;
  status: IssueStatus;
  dueDate: string | null;
}

/**
 * Issue type from database
 */
export type Issue = Tables<'issues'>;

/**
 * Issue insert type
 */
export type IssueInsert = TablesInsert<'issues'>;

/**
 * Issue update type
 */
export type IssueUpdate = TablesUpdate<'issues'>;

export type IssueTag = {
  id?: string | null;
  issue_id?: string | null;
  student_id?: string | null;
  staff_id?: string | null;
  parent_id?: string | null;
  class_id?: string | null;
  session_id?: string | null;
  invoice_id?: string | null;
  subject_id?: string | null;
};

export type IssueTagInsert = Omit<IssueTag, 'id'>;

/**
 * Issue with related tags and activity info
 */
export interface IssueWithTags extends Issue {
  tags: IssueTag[];
  created_by_staff?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

/**
 * Issue filters for queries
 */
export interface IssueFilters {
  status?: IssueStatus[];
  search?: string;
  due_date?: unknown[];
  [key: string]: unknown;
}
