import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { JSONContent } from '@altitutor/ui';
import type { ProjectStaffRef } from '../utils/projectMembers';

export type ProjectStatus = 'backlog' | 'planned' | 'in_progress' | 'completed';
export type ProjectPriority = 0 | 1 | 2 | 3 | 4;

export interface ProjectFormData {
  name: string;
  description?: JSONContent | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  projectLeadId: string | null;
  memberIds: string[];
  startDate: string | null;
  targetDate: string | null;
}

export type Project = Tables<'projects'>;
export type ProjectInsert = TablesInsert<'projects'>;
export type ProjectUpdate = TablesUpdate<'projects'>;
export type ProjectUpdateInput = ProjectUpdate & {
  member_ids?: string[];
};

export interface ProjectCreateInput extends ProjectInsert {
  memberIds?: string[];
}

export interface ProjectFilters {
  status?: ProjectStatus[];
  priority?: ProjectPriority | ProjectPriority[];
  project_lead_id?: string | string[];
  member?: string | string[];
  search?: string;
  [key: string]: unknown;
}

export interface ProjectWithLead extends Project {
  project_lead?: ProjectStaffRef | null;
  creator?: ProjectStaffRef | null;
  members: ProjectStaffRef[];
}
