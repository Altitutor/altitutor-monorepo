import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskFilters, TaskWithAssignee, TaskInsert, TaskUpdate } from '../types';

/**
 * Tasks API client for working with task data
 */
export const tasksApi = {
  /**
   * Get all tasks with optional filters
   */
  list: async (filters?: TaskFilters): Promise<TaskWithAssignee[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const {
      status,
      assignedTo,
      priority,
      search,
    } = filters || {};

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:staff!tasks_assigned_to_fkey(id, first_name, last_name),
        creator:staff!tasks_created_by_fkey(id, first_name, last_name)
      `);

    // Status filter
    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    // Assigned to filter (support both single and array)
    if (assignedTo) {
      if (Array.isArray(assignedTo)) {
        if (assignedTo.length > 0) {
          query = query.in('assigned_to', assignedTo);
        }
      } else {
        query = query.eq('assigned_to', assignedTo);
      }
    }

    // Priority filter (support both single and array)
    if (priority !== undefined) {
      if (Array.isArray(priority)) {
        if (priority.length > 0) {
          query = query.in('priority', priority);
        }
      } else {
        query = query.eq('priority', priority);
      }
    }

    // Search filter (title and description)
    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
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
        creator:staff!tasks_created_by_fkey(id, first_name, last_name)
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

