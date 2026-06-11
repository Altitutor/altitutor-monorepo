'use client';

import { useState } from 'react';
import { Button, SegmentedControl } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { IssuesBoard } from '@/features/issues/components/IssuesBoard';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';

export default function IssuesPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const handleCreateIssue = () => {
    setIsCreateDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
        </div>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as 'kanban' | 'list')}
            options={[
              { value: 'kanban', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          <Button onClick={handleCreateIssue}>
            <Plus className="h-4 w-4 mr-2" />
            New Issue
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <IssuesBoard />
        ) : (
          <IssuesList />
        )}
      </div>

      <CreateIssueDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
}
