import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, ProjectFilters, ProjectInsert, ProjectUpdate, ProjectWithLead } from '../types';

export const projectsApi = {
  search: async (
    search: string,
    limit = 8
  ): Promise<Array<Pick<Project, 'id' | 'name' | 'status' | 'target_date' | 'priority'>>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const trimmed = search.trim();

    if (trimmed.length > 0) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, target_date, priority')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Array<Pick<Project, 'id' | 'name' | 'status' | 'target_date' | 'priority'>>;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, target_date, priority')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Array<Pick<Project, 'id' | 'name' | 'status' | 'target_date' | 'priority'>>;
  },

  list: async (filters?: ProjectFilters): Promise<ProjectWithLead[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { status, priority, search, ...otherFilters } = filters || {};

    let query = supabase
      .from('projects')
      .select(`
        *,
        project_lead:staff!projects_project_lead_id_fkey(id, first_name, last_name),
        creator:staff!projects_created_by_fkey(id, first_name, last_name)
      `);

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    if (priority !== undefined) {
      const priorityValues = Array.isArray(priority) ? priority : [priority];
      if (priorityValues.length > 0) {
        query = query.in('priority', priorityValues);
      }
    }

    if (search && search.trim().length > 0) {
      query = query.textSearch('search_vector', search.trim(), {
        type: 'websearch',
        config: 'english',
      });
    }

    for (const [key, value] of Object.entries(otherFilters)) {
      if (!Array.isArray(value) || value.length === 0) continue;

      const dateRanges = value.filter(
        (v) => typeof v === 'object' && v !== null && (v as { type?: string }).type === 'date_range'
      );
      const otherValues = value.filter(
        (v) => typeof v !== 'object' || v === null || (v as { type?: string }).type !== 'date_range'
      );

      if (otherValues.length > 0) {
        query = query.in(key, otherValues);
      }

      if (dateRanges.length > 0) {
        const dr = dateRanges[0] as { operator?: 'gte' | 'lte'; start?: string; end?: string };
        if (dr.operator === 'gte' && dr.start) {
          query = query.gte(key, dr.start);
        } else if (dr.operator === 'lte' && dr.end) {
          query = query.lte(key, dr.end);
        } else if (dr.start && dr.end) {
          query = query.gte(key, dr.start).lte(key, dr.end);
        } else if (dr.start) {
          query = query.gte(key, dr.start);
        } else if (dr.end) {
          query = query.lte(key, dr.end);
        }
      }
    }

    query = query.order('priority', { ascending: true }).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as unknown as ProjectWithLead[];
  },

  get: async (projectId: string): Promise<ProjectWithLead | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_lead:staff!projects_project_lead_id_fkey(id, first_name, last_name),
        creator:staff!projects_created_by_fkey(id, first_name, last_name)
      `)
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data as unknown as ProjectWithLead | null;
  },

  create: async (project: ProjectInsert): Promise<ProjectWithLead> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (projectError) throw projectError;
    return projectsApi.get(projectData.id) as Promise<ProjectWithLead>;
  },

  update: async (projectId: string, updates: ProjectUpdate): Promise<Project> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  delete: async (projectId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
  },
};
