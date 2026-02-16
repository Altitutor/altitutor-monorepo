import type { Tables, Database } from '@altitutor/shared';
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
      ...otherFilters
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
      const assignedToValues = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
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
      
      const dateRanges = values.filter(v => typeof v === 'object' && v !== null && (v as any).type === 'date_range');
      const otherValues = values.filter(v => typeof v !== 'object' || v === null || (v as any).type !== 'date_range');
      
      if (otherValues.length > 0) {
        query = query.in(key, otherValues);
      }
      
      if (dateRanges.length > 0) {
        const dr = dateRanges[0] as any;
        if (dr.operator === 'gte' && dr.start) {
          query = query.gte(key, dr.start);
        } else if (dr.operator === 'lte' && dr.end) {
          query = query.lte(key, dr.end);
        } else if (dr.start && dr.end) {
          query = query.gte(key, dr.start).lte(key, dr.end);
        }
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

