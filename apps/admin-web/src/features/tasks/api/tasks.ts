import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskFilters, TaskWithAssignee, TaskInsert, TaskUpdate } from '../types';

/**
 * Tasks API client for working with task data
 */
export const tasksApi = {
  /**
   * Search tasks for mention/command palette usage.
   * @param excludeLinked - when true, only return tasks not linked to any issue or project
   */
  search: async (
    search: string,
    limit = 8,
    options?: { excludeLinked?: boolean }
  ): Promise<Array<Pick<Tables<'tasks'>, 'id' | 'title' | 'status' | 'due_date' | 'priority'>>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const trimmed = search.trim();
    const excludeLinked = options?.excludeLinked ?? false;

    if (trimmed.length > 0) {
      let query = supabase
        .from('tasks')
        .select('id, title, status, due_date, priority')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (excludeLinked) {
        query = query.is('issue_id', null).is('project_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Array<Pick<Tables<'tasks'>, 'id' | 'title' | 'status' | 'due_date' | 'priority'>>;
    }

    let query = supabase
      .from('tasks')
      .select('id, title, status, due_date, priority')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (excludeLinked) {
      query = query.is('issue_id', null).is('project_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Array<Pick<Tables<'tasks'>, 'id' | 'title' | 'status' | 'due_date' | 'priority'>>;
  },

  /**
   * Get all tasks with optional filters
   */
  list: async (filters?: TaskFilters): Promise<TaskWithAssignee[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const {
      status,
      assignedTo,
      assignee,
      assigned_to, // Support all variants
      unassignedOnly,
      priority,
      search,
      ...otherFilters
    } = filters || {};

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:staff!tasks_assigned_to_fkey(id, first_name, last_name),
        creator:staff!tasks_created_by_fkey(id, first_name, last_name),
        issue:issues!tasks_issue_id_fkey(id, name),
        project:projects!tasks_project_id_fkey(id, name)
      `);

    // Status filter
    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    // Unassigned filter (tasks with no assignee)
    if (unassignedOnly) {
      query = query.is('assigned_to', null);
    }

    // Assigned to filter (support both single and array, and all key names)
    const effectiveAssignedTo = assignedTo || assignee || assigned_to;
    if (effectiveAssignedTo && !unassignedOnly) {
      const assignedToValues = Array.isArray(effectiveAssignedTo) ? effectiveAssignedTo : [effectiveAssignedTo];
      if (assignedToValues.length > 0) {
        query = query.in('assigned_to', assignedToValues);
      }
    }

    // Priority filter (support both single and array)
    if (priority !== undefined) {
      const priorityValues = Array.isArray(priority) ? priority : [priority];
      if (priorityValues.length > 0) {
        query = query.in('priority', priorityValues);
      }
    }

    // Handle other dynamic filters
    for (const [key, values] of Object.entries(otherFilters)) {
      if (!Array.isArray(values) || values.length === 0) continue;
      
      type DateRangeFilter = { type: 'date_range'; operator?: 'gte' | 'lte'; start?: string; end?: string };
      const dateRanges = values.filter((v): v is DateRangeFilter => typeof v === 'object' && v !== null && (v as DateRangeFilter).type === 'date_range');
      const otherValues = values.filter(v => typeof v !== 'object' || v === null || (v as DateRangeFilter).type !== 'date_range');
      
      if (otherValues.length > 0) {
        query = query.in(key, otherValues);
      }
      
      if (dateRanges.length > 0) {
        const dr = dateRanges[0];
        if (dr.operator === 'gte' && dr.start) {
          query = query.gte(key, dr.start);
        } else if (dr.operator === 'lte' && dr.end) {
          query = query.lte(key, dr.end);
        } else if (dr.start && dr.end) {
          query = query.gte(key, dr.start).lte(key, dr.end);
        }
      }
    }

    // Search filter (full-text search)
    if (search && search.trim().length > 0) {
      query = query.textSearch('search_vector', search.trim(), {
        type: 'websearch',
        config: 'english',
      });
    }

    // Order by priority DESC, then created_at DESC
    query = query.order('priority', { ascending: false, nullsFirst: false });
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as unknown as TaskWithAssignee[];
  },

  /**
   * Get a single task by ID
   */
  get: async (taskId: string): Promise<TaskWithAssignee | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:staff!tasks_assigned_to_fkey(id, first_name, last_name),
        creator:staff!tasks_created_by_fkey(id, first_name, last_name),
        issue:issues!tasks_issue_id_fkey(id, name),
        project:projects!tasks_project_id_fkey(id, name)
      `)
      .eq('id', taskId)
      .single();

    if (error) throw error;
    return data as unknown as TaskWithAssignee | null;
  },

  /**
   * Create a new task
   */
  create: async (task: TaskInsert): Promise<Tables<'tasks'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'tasks'>;
  },

  /**
   * Update a task
   */
  update: async (taskId: string, updates: TaskUpdate): Promise<Tables<'tasks'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'tasks'>;
  },

  /**
   * Delete a task
   */
  delete: async (taskId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};
