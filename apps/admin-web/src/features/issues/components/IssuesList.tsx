'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListStatusColumn,
  type EntityListPillColumn,
  RichTextEditor,
} from '@altitutor/ui';
import { useIssues } from '../api/queries';
import { useUpdateIssue } from '../api/mutations';
import { EditIssueDialog } from './EditIssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { cn } from '@/shared/utils';
import { Circle, Clock, CheckCircle } from 'lucide-react';
import type { IssueWithTags, IssueStatus } from '../types';

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function IssuesList() {
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: issues = [], isLoading } = useIssues(filters);
  const updateIssue = useUpdateIssue();

  const handleStatusChange = useCallback(
    (issue: IssueWithTags, value: IssueStatus) => {
      updateIssue.mutate({ id: issue.id, updates: { status: value } });
    },
    [updateIssue]
  );

  const handleAdd = useCallback(
    () => {
      setIsCreateDialogOpen(true);
    },
    []
  );

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
    onStatusChange: handleStatusChange,
  };

  return (
    <>
      <EntityList<IssueWithTags>
        items={issues}
        getItemId={(i) => i.id}
        renderName={(i) => <span>{i.name}</span>}
        statusColumn={statusColumn as any}
        rightPills={[]}
        onAdd={handleAdd}
        onRowClick={(i) => {
          setSelectedIssueId(i.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add issue"
        emptyMessage="No issues match your filters"
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        descriptionConfig={{
          enabled: true,
          renderEditor: ({ value, onChange, placeholder, ref }) => (
            <RichTextEditor
              ref={ref as any}
              content={value}
              onChange={onChange}
              placeholder={placeholder}
              className="min-h-[60px]"
            />
          ),
          placeholder: "Add issue description..."
        }}
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
      />
    </>
  );
}
