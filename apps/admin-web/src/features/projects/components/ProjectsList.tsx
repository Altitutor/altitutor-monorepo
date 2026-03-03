'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListStatusColumn,
  RichTextEditor,
} from '@altitutor/ui';
import { useProjects } from '../api/queries';
import { useUpdateProject } from '../api/mutations';
import { TextWithTags } from '@/shared/components/TextWithTags';
import { EditProjectDialog } from './EditProjectDialog';
import { CreateProjectDialog } from './CreateProjectDialog';
import { cn } from '@/shared/utils';
import { Circle, Clock3, Flag, CheckCircle2 } from 'lucide-react';
import type { ProjectWithLead, ProjectStatus } from '../types';
import { getProjectStatusLabel, getProjectStatusOrder } from '../utils/projectUtils';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export function ProjectsList() {
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>('status');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: projects = [], isLoading } = useProjects(filters as import('../types').ProjectFilters);
  const updateProject = useUpdateProject();

  const handleStatusChange = useCallback((project: ProjectWithLead, value: ProjectStatus) => {
    updateProject.mutate({ id: project.id, updates: { status: value } });
  }, [updateProject]);

  const statusColumn: EntityListStatusColumn<ProjectWithLead, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (p) => p.status as ProjectStatus,
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
    onStatusChange: (project, value) => handleStatusChange(project, value as ProjectStatus),
  };

  const groupByOptions = useMemo(() => [{ key: 'status', label: 'Status' }], []);
  const sortByOptions = useMemo(() => [{ key: 'status', label: 'Status' }], []);

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  return (
    <>
      <EntityList<ProjectWithLead>
        items={projects}
        getItemId={(p) => p.id}
        renderName={(p) => <TextWithTags text={p.name} />}
        statusColumn={statusColumn}
        rightPills={[]}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        getGroupOrder={(columnKey, valueKey) => {
          if (columnKey === 'status') return getProjectStatusOrder(valueKey);
          return 0;
        }}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getProjectStatusLabel(valueKey as ProjectStatus);
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={() => setIsCreateDialogOpen(true)}
        onRowClick={(p) => {
          setSelectedProjectId(p.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add project"
        emptyMessage="No projects match your filters"
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        descriptionConfig={{
          enabled: true,
          renderEditor: ({ value, onChange, placeholder, ref }) => (
            <RichTextEditor
              ref={ref as React.RefObject<import('@altitutor/ui').RichTextEditorRef>}
              content={value}
              onChange={onChange}
              placeholder={placeholder}
              className="min-h-[60px]"
            />
          ),
          placeholder: 'Add project description...'
        }}
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
        onProjectCreated={(projectId) => {
          setSelectedProjectId(projectId);
          setIsEditDialogOpen(true);
        }}
      />
    </>
  );
}
