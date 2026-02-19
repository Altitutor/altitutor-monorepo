'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
  type KanbanColumnDef,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useIssues } from '../api/queries';
import { useUpdateIssue, useCreateIssue } from '../api/mutations';
import { IssueCard } from './IssueCard';
import { EditIssueDialog } from './EditIssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import type { IssueWithTags, IssueStatus } from '../types';
import { cn } from '@/shared/utils';
import { Circle, Clock, CheckCircle } from 'lucide-react';

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function IssuesBoard() {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] = useState<IssueStatus>('open');

  const { data: issues = [], isLoading } = useIssues(filters);
  const updateIssue = useUpdateIssue();
  const createIssue = useCreateIssue();

  const handleUpdate = useCallback(
    (issue: IssueWithTags, updates: any) => {
      updateIssue.mutate({ id: issue.id, updates });
    },
    [updateIssue]
  );

  const handleAdd = useCallback(
    (columnValue: any) => {
      setCreateColumnValue(columnValue as IssueStatus);
      setIsCreateDialogOpen(true);
    },
    []
  );

  const columnDefs: KanbanColumnDef<IssueWithTags, any>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      getValue: (i) => i.status,
      options: STATUS_OPTIONS,
      onValueChange: (i, v) => handleUpdate(i, { status: v }),
    }
  ], [handleUpdate]);

  const statusColumn: EntityListStatusColumn<IssueWithTags, IssueStatus> = {
    key: 'status',
    label: 'Status',
    getValue: (i) => i.status as IssueStatus,
    defaultValue: 'open',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'open' ? Circle : opt.value === 'awaiting_response' ? Clock : CheckCircle
    })),
    renderBubble: (value, collapsed) => {
      const option = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];
      const Icon = value === 'open' ? Circle : value === 'awaiting_response' ? Clock : CheckCircle;
      const color = value === 'open' ? 'text-blue-500' : value === 'awaiting_response' ? 'text-yellow-500' : 'text-green-500';

      if (collapsed) return <Icon className={cn("h-3 w-3", color)} />;

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', color)}>
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (issue, value) => handleUpdate(issue, { status: value }),
  };

  return (
    <>
      <KanbanBoard<IssueWithTags>
        items={issues}
        getItemId={(i) => i.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={(i) => (
          <IssueCard 
            issue={i} 
            onClick={() => {
              setSelectedIssueId(i.id);
              setIsEditDialogOpen(true);
            }} 
          />
        )}
        statusColumn={statusColumn as any}
        rightPills={[]}
        onAdd={handleAdd}
        isLoading={isLoading}
        emptyMessage="No issues found"
        filters={filters}
        onFiltersChange={setFilters}
      />

      {selectedIssueId && (
        <EditIssueDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedIssueId(null);
          }}
          issueId={selectedIssueId}
        />
      )}

      <CreateIssueDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialStatus={createColumnValue}
      />
    </>
  );
}
