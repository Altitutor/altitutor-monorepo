import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { otherMemberIds, type ProjectStaffRef } from '../utils/projectMembers';
import type {
  Project,
  ProjectFilters,
  ProjectInsert,
  ProjectUpdateInput,
  ProjectWithLead,
} from '../types';

const PROJECT_LIST_SELECT = `
  *,
  project_lead:staff!projects_project_lead_id_fkey(id, first_name, last_name),
  creator:staff!projects_created_by_fkey(id, first_name, last_name)
`;

type ProjectMemberRow = {
  project_id: string;
  staff: ProjectStaffRef | ProjectStaffRef[] | null;
};

function asIdList(value: unknown): string[] {
  if (typeof value === 'string' && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function staffFromEmbed(staff: ProjectStaffRef | ProjectStaffRef[] | null): ProjectStaffRef[] {
  if (!staff) return [];
  return (Array.isArray(staff) ? staff : [staff]).filter((person): person is ProjectStaffRef => Boolean(person?.id));
}

async function loadMembersByProjectId(
  supabase: SupabaseClient<Database>,
  projectIds: string[]
): Promise<Map<string, ProjectStaffRef[]>> {
  const membersByProject = new Map<string, ProjectStaffRef[]>();
  if (projectIds.length === 0) return membersByProject;

  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, staff:staff!project_members_staff_id_fkey(id, first_name, last_name)')
    .in('project_id', projectIds);

  if (error) {
    console.error('Failed to load project members', error);
    return membersByProject;
  }

  for (const row of (data ?? []) as unknown as ProjectMemberRow[]) {
    const current = membersByProject.get(row.project_id) ?? [];
    membersByProject.set(row.project_id, [...current, ...staffFromEmbed(row.staff)]);
  }

  return membersByProject;
}

function withMembers(
  project: Omit<ProjectWithLead, 'members'>,
  membersByProject: Map<string, ProjectStaffRef[]>
): ProjectWithLead {
  return {
    ...project,
    members: membersByProject.get(project.id) ?? [],
  };
}

async function syncProjectMembers(
  supabase: SupabaseClient<Database>,
  projectId: string,
  otherMemberIds: string[],
  leadId: string | null
): Promise<void> {
  const desired = new Set(otherMemberIds.filter((id) => id !== leadId));
  if (leadId) desired.add(leadId);

  const { data: existing, error: existingError } = await supabase
    .from('project_members')
    .select('staff_id')
    .eq('project_id', projectId);

  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((row) => row.staff_id));
  const toInsert = [...desired].filter((id) => !existingIds.has(id));
  const toDelete = [...existingIds].filter((id) => !desired.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .in('staff_id', toDelete);
    if (error) throw error;
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('project_members').insert(
      toInsert.map((staff_id) => ({ project_id: projectId, staff_id }))
    );
    if (error) throw error;
  }
}

export function getProjectFilterColumn(key: string): string {
  return key === 'project_lead' ? 'project_lead_id' : key;
}

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
    const { status, priority, search, member, ...otherFilters } = filters || {};

    let query = supabase.from('projects').select(PROJECT_LIST_SELECT);

    const memberIds = asIdList(member);
    if (memberIds.length > 0) {
      const { data: memberships, error: membershipError } = await supabase
        .from('project_members')
        .select('project_id')
        .in('staff_id', memberIds);

      if (membershipError) {
        query = query.in('project_lead_id', memberIds);
      } else {
        const projectIds = [...new Set((memberships ?? []).map((row) => row.project_id))];
        if (projectIds.length === 0) return [];
        query = query.in('id', projectIds);
      }
    }

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

      const column = getProjectFilterColumn(key);

      const dateRanges = value.filter(
        (v) => typeof v === 'object' && v !== null && (v as { type?: string }).type === 'date_range'
      );
      const otherValues = value.filter(
        (v) => typeof v !== 'object' || v === null || (v as { type?: string }).type !== 'date_range'
      );

      if (otherValues.length > 0) {
        query = query.in(column, otherValues);
      }

      if (dateRanges.length > 0) {
        const dr = dateRanges[0] as { operator?: 'gte' | 'lte'; start?: string; end?: string };
        if (dr.operator === 'gte' && dr.start) {
          query = query.gte(column, dr.start);
        } else if (dr.operator === 'lte' && dr.end) {
          query = query.lte(column, dr.end);
        } else if (dr.start && dr.end) {
          query = query.gte(column, dr.start).lte(column, dr.end);
        } else if (dr.start) {
          query = query.gte(column, dr.start);
        } else if (dr.end) {
          query = query.lte(column, dr.end);
        }
      }
    }

    query = query.order('priority', { ascending: true }).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const projects = (data ?? []) as unknown as Array<Omit<ProjectWithLead, 'members'>>;
    const membersByProject = await loadMembersByProjectId(
      supabase,
      projects.map((project) => project.id)
    );
    return projects.map((project) => withMembers(project, membersByProject));
  },

  get: async (projectId: string): Promise<ProjectWithLead | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_LIST_SELECT)
      .eq('id', projectId)
      .single();

    if (error) throw error;
    if (!data) return null;

    const project = data as unknown as Omit<ProjectWithLead, 'members'>;
    const membersByProject = await loadMembersByProjectId(supabase, [project.id]);
    return withMembers(project, membersByProject);
  },

  create: async (project: ProjectInsert, memberIds?: string[]): Promise<ProjectWithLead> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (projectError) throw projectError;

    await syncProjectMembers(
      supabase,
      projectData.id,
      otherMemberIds(memberIds ?? [], projectData.project_lead_id),
      projectData.project_lead_id
    );

    return projectsApi.get(projectData.id) as Promise<ProjectWithLead>;
  },

  update: async (projectId: string, updates: ProjectUpdateInput): Promise<Project> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { member_ids, ...row } = updates;

    if (Object.keys(row).length > 0) {
      const { data, error } = await supabase
        .from('projects')
        .update(row)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      if (member_ids !== undefined) {
        await syncProjectMembers(
          supabase,
          projectId,
          otherMemberIds(member_ids, data.project_lead_id),
          data.project_lead_id
        );
      }

      return data as Project;
    }

    if (member_ids !== undefined) {
      const { data: current, error: currentError } = await supabase
        .from('projects')
        .select('project_lead_id')
        .eq('id', projectId)
        .single();

      if (currentError) throw currentError;

      await syncProjectMembers(
        supabase,
        projectId,
        otherMemberIds(member_ids, current.project_lead_id),
        current.project_lead_id
      );
    }

    const { data, error } = await supabase
      .from('projects')
      .select()
      .eq('id', projectId)
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
