'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
  type KanbanColumnDef,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useProjects } from '../api/queries';
import { useUpdateProject } from '../api/mutations';
import { ProjectCard } from './ProjectCard';
import { EditProjectDialog } from './EditProjectDialog';
import { CreateProjectDialog } from './CreateProjectDialog';
import type { ProjectStatus, ProjectWithLead } from '../types';
import { cn } from '@/shared/utils';
import { Circle, Clock3, Flag, CheckCircle2 } from 'lucide-react';
import { getProjectStatusLabel } from '../utils/projectUtils';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export function ProjectsBoard() {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] = useState<ProjectStatus>('backlog');

  const { data: projects = [], isLoading } = useProjects(filters as import('../types').ProjectFilters);
  const updateProject = useUpdateProject();
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleUpdate = useCallback(
    (project: ProjectWithLead, updates: Partial<import('../types').ProjectUpdate>) => {
      updateProject.mutate({ id: project.id, updates });
    },
    [updateProject]
  );

  const handleAdd = useCallback((columnValue: unknown) => {
    setCreateColumnValue(columnValue as ProjectStatus);
    setIsCreateDialogOpen(true);
  }, []);

  const columnDefs: KanbanColumnDef<ProjectWithLead, unknown>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      getValue: (p) => p.status,
      options: STATUS_OPTIONS,
      onValueChange: (p, v) => handleUpdate(p, { status: v as ProjectStatus }),
    }
  ], [handleUpdate]);

  const groupByOptions = useMemo(() => [{ key: 'status', label: 'Status' }], []);
  const sortByOptions = useMemo(() => [{ key: 'status', label: 'Status' }], []);

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  const statusColumn: EntityListStatusColumn<ProjectWithLead, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (p) => p.status,
    defaultValue: 'backlog',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'backlog' ? Circle : opt.value === 'planned' ? Clock3 : opt.value === 'in_progress' ? Flag : CheckCircle2,
    })),
    renderBubble: (value: unknown, collapsed) => {
      const status = value as ProjectStatus;
      const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
      const Icon = status === 'backlog' ? Circle : status === 'planned' ? Clock3 : status === 'in_progress' ? Flag : CheckCircle2;
      const color = status === 'backlog' ? 'text-muted-foreground' : status === 'planned' ? 'text-blue-500' : status === 'in_progress' ? 'text-yellow-500' : 'text-green-500';

      if (collapsed) return <Icon className={cn('h-3 w-3', color)} />;
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', color)}>
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (project, value) => handleUpdate(project, { status: value as ProjectStatus }),
  };

  return (
    <>
      <KanbanBoard<ProjectWithLead>
        items={projects}
        getItemId={(p) => p.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={(p) => (
          <ProjectCard
            project={p}
            onClick={() => {
              setSelectedProjectId(p.id);
              setIsEditDialogOpen(true);
            }}
          />
        )}
        statusColumn={statusColumn}
        rightPills={[]}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getProjectStatusLabel(valueKey as ProjectStatus);
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={handleAdd}
        isLoading={isLoading}
        emptyMessage="No projects found"
        filters={filters}
        onFiltersChange={setFilters}
      />

      {selectedProjectId && (
        <EditProjectDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedProjectId(null);
          }}
          projectId={selectedProjectId}
        />
      )}

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialStatus={createColumnValue}
        onProjectCreated={(projectId) => {
          setSelectedProjectId(projectId);
          setIsEditDialogOpen(true);
        }}
      />
    </>
  );
}
