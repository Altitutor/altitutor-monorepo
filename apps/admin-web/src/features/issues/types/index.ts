import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';

/**
 * Issue status types
 */
export type IssueStatus = 'open' | 'awaiting_response' | 'resolved';

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

/**
 * Issue tag type
 */
export type IssueTag = Tables<'issue_tags'>;

/**
 * Issue tag insert type
 */
export type IssueTagInsert = TablesInsert<'issue_tags'>;

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
